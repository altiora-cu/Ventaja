import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FixtureStats, League } from '@/lib/db/types';
import { markFetched, shouldFetch } from './cache';
import { activeLeagues } from './ingest';
import { FDCO_BASE, FDCO_DIV, fdcoFinished, fdcoQuotes, fdcoSeasonCode, fdcoStats, matchFdcoRows, parseFdcoCsv, type FdcoRow } from './providers/fdco-parse';

export interface FdcoReport {
  leagues: number;
  /** Partidos terminados a los que se añadieron xG, tiros, corners y tarjetas. */
  statsUpdated: number;
  /** Partidos próximos con cuotas cargadas desde el archivo, y número de cuotas. */
  oddsFixtures: number;
  quotes: number;
  /** Filas del archivo sin partido correspondiente en nuestra base (primeras 10). */
  unmatched: string[];
  skipped: string[];
  errors: string[];
}

const SEASON_TTL_MS = 12 * 3600_000;
const FIXTURES_TTL_MS = 3 * 3600_000;
const UPCOMING_DAYS = 8;
const DAY_MS = 86_400_000;
const CHUNK = 10;

type DbFixture = { id: number; kickoff: string; status: string; stats: FixtureStats | null; home: { name: string }; away: { name: string } };

async function fetchCsv(path: string): Promise<FdcoRow[]> {
  const res = await fetch(`${FDCO_BASE}/${path}`, { redirect: 'follow', cache: 'no-store', headers: { 'user-agent': 'Mozilla/5.0 (compatible; ventaja-stats/1.0)' } });
  if (!res.ok) throw new Error(`football-data.co.uk ${path}: HTTP ${res.status}`);
  return parseFdcoCsv(await res.text());
}

async function leagueFixtures(admin: SupabaseClient, league: League, from: string, to: string, statuses: string[]): Promise<DbFixture[]> {
  const { data, error } = await admin
    .from('fixtures')
    .select('id,kickoff,status,stats,home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name)')
    .eq('league_id', league.id)
    .eq('season', league.season)
    .in('status', statuses)
    .gte('kickoff', from)
    .lte('kickoff', to)
    .limit(1000)
    .returns<DbFixture[]>();
  if (error) throw error;
  return data ?? [];
}

/**
 * football-data.co.uk (gratis, sin clave) para Premier, La Liga, Serie A, Bundesliga y Ligue 1:
 * 1. Estadísticas de los partidos terminados (xG, tiros, tiros al arco, corners, tarjetas) → `fixtures.stats`,
 *    que alimenta el modelo y los mercados de corners, tarjetas y tiros.
 * 2. Cuotas de los próximos partidos (1X2 y más/menos 2.5 de varias casas) para las ligas que NO reciben
 *    cuotas de The Odds API (`odds_enabled = false`): no gasta créditos.
 * El proveedor publica las cuotas del fin de semana el viernes por la tarde y las de entre semana el martes.
 */
export async function ingestFdco(now = new Date()): Promise<FdcoReport> {
  const report: FdcoReport = { leagues: 0, statsUpdated: 0, oddsFixtures: 0, quotes: 0, unmatched: [], skipped: [], errors: [] };
  if (process.env.VENTAJA_FDCO === 'false') return report;
  const admin = createAdminClient();
  const leagues = (await activeLeagues(admin)).filter((l) => FDCO_DIV[l.id]);
  report.leagues = leagues.length;
  const noteUnmatched = (rows: FdcoRow[], matched: Map<number, number>) => {
    rows.forEach((r, i) => {
      if (!matched.has(i) && report.unmatched.length < 10) report.unmatched.push(`${r.div} ${r.home} vs ${r.away} ${r.kickoff.slice(0, 10)}`);
    });
  };

  // 1. Estadísticas de la temporada
  for (const league of leagues) {
    const div = FDCO_DIV[league.id];
    const key = `fdco:season:${div}:${league.season}`;
    if (!(await shouldFetch(admin, key, SEASON_TTL_MS))) {
      report.skipped.push(key);
      continue;
    }
    try {
      const rows = (await fetchCsv(`mmz4281/${fdcoSeasonCode(league.season)}/${div}.csv`)).filter(fdcoFinished);
      const fixtures = await leagueFixtures(admin, league, new Date(now.getTime() - 400 * DAY_MS).toISOString(), now.toISOString(), ['FT', 'AET', 'PEN']);
      const matched = matchFdcoRows(rows, fixtures.map((f) => ({ id: f.id, kickoff: f.kickoff, home: f.home.name, away: f.away.name })));
      noteUnmatched(rows, matched);
      const byId = new Map(fixtures.map((f) => [f.id, f]));
      const updates: Array<{ id: number; stats: FixtureStats }> = [];
      for (const [i, id] of matched) {
        const stats = fdcoStats(rows[i]);
        const current = byId.get(id)?.stats ?? null;
        // Solo lo que falta: no pisa estadísticas ya cargadas por otra fuente.
        if (!stats || (current?.corners && current?.xg)) continue;
        updates.push({ id, stats: { ...stats, ...(current ?? {}) } });
      }
      for (let i = 0; i < updates.length; i += CHUNK) {
        const results = await Promise.all(updates.slice(i, i + CHUNK).map((u) => admin.from('fixtures').update({ stats: u.stats }).eq('id', u.id)));
        for (const r of results) {
          if (r.error) report.errors.push(`${div} stats: ${r.error.message}`);
          else report.statsUpdated++;
        }
      }
      await markFetched(admin, key, `stats ${updates.length}/${rows.length}`, rows.length);
    } catch (e) {
      report.errors.push(`${key}: ${(e as Error).message}`);
    }
  }

  // 2. Cuotas de los próximos partidos (solo ligas sin cuotas de The Odds API)
  const oddsLeagues = leagues.filter((l) => l.odds_enabled === false);
  const fxKey = 'fdco:fixtures';
  if (oddsLeagues.length && (await shouldFetch(admin, fxKey, FIXTURES_TTL_MS))) {
    try {
      const all = await fetchCsv('fixtures.csv');
      let total = 0;
      for (const league of oddsLeagues) {
        const rows = all.filter((r) => r.div === FDCO_DIV[league.id] && !fdcoFinished(r));
        if (!rows.length) continue;
        const fixtures = await leagueFixtures(admin, league, new Date(now.getTime() - 2 * 3600_000).toISOString(), new Date(now.getTime() + UPCOMING_DAYS * DAY_MS).toISOString(), ['NS', 'TBD']);
        const matched = matchFdcoRows(rows, fixtures.map((f) => ({ id: f.id, kickoff: f.kickoff, home: f.home.name, away: f.away.name })));
        noteUnmatched(rows, matched);
        for (const [i, id] of matched) {
          const quotes = fdcoQuotes(rows[i]);
          if (!quotes.length) continue;
          await admin.from('odds').delete().eq('fixture_id', id);
          const { error } = await admin.from('odds').insert(quotes.map((q) => ({ fixture_id: id, ...q, fetched_at: now.toISOString() })));
          if (error) {
            report.errors.push(`${league.name} cuotas #${id}: ${error.message}`);
            continue;
          }
          report.oddsFixtures++;
          report.quotes += quotes.length;
          total += quotes.length;
        }
      }
      await markFetched(admin, fxKey, `cuotas ${report.oddsFixtures} partidos`, total);
    } catch (e) {
      report.errors.push(`${fxKey}: ${(e as Error).message}`);
    }
  } else if (oddsLeagues.length) report.skipped.push(fxKey);

  return report;
}
