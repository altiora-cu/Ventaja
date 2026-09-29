import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { League, Team } from '@/lib/db/types';
import { addDays } from '@/lib/utils';
import { activeLeagues } from './ingest';
import { markFetched, shouldFetch, TTL } from './cache';
import { matchFixturesToEvents } from './matching';
import { EXTRA_MARKETS_ENABLED, normalizeEvent, oddsApi, oddsUsage } from './odds-api';

export interface OddsReport {
  sports: number;
  eventsMatched: number;
  quotesUpserted: number;
  extraEvents: number;
  skipped: string[];
  errors: string[];
  usage: ReturnType<typeof oddsUsage>;
}

interface FixtureLite {
  id: number;
  kickoff: string;
  league_id: number;
  odds_event_id: string | null;
  home: Pick<Team, 'name'>;
  away: Pick<Team, 'name'>;
}

/** Créditos que se reservan para resultados (no se recuperan si faltan). */
const ODDS_MIN_CREDITS = Number(process.env.ODDS_MIN_CREDITS) || 50;

/**
 * Cuotas de The Odds API para los partidos de los próximos 3 días.
 * Cada 2 h; cada 15 min el día del partido (TTL más corto para eventos de hoy).
 */
export async function ingestOdds(): Promise<OddsReport> {
  const admin = createAdminClient();
  const report: OddsReport = { sports: 0, eventsMatched: 0, quotesUpserted: 0, extraEvents: 0, skipped: [], errors: [], usage: oddsUsage() };
  // Solo ligas con cobertura y con cuotas habilitadas (presupuesto de créditos, migración 0008).
  const leagues = (await activeLeagues(admin)).filter((l): l is League & { odds_sport_key: string } => Boolean(l.odds_sport_key) && l.odds_enabled !== false);
  const now = new Date();
  const todayEnd = new Date(now.getTime() + 24 * 3600_000);

  const { data: fixtures } = await admin
    .from('fixtures')
    .select('id,kickoff,league_id,odds_event_id,home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name)')
    .gte('kickoff', new Date(now.getTime() - 3600_000).toISOString())
    .lte('kickoff', addDays(now, 3).toISOString())
    .in('status', ['NS', 'TBD'])
    .returns<FixtureLite[]>();

  const bySport = new Map<string, FixtureLite[]>();
  for (const l of leagues) bySport.set(l.odds_sport_key, (fixtures ?? []).filter((f) => f.league_id === l.id));

  for (const [sportKey, fxs] of bySport) {
    if (!fxs.length) continue;
    const hasToday = fxs.some((f) => new Date(f.kickoff) <= todayEnd);
    const key = `odds:${sportKey}`;
    if (!(await shouldFetch(admin, key, hasToday ? TTL.oddsMatchDay : TTL.odds))) {
      report.skipped.push(key);
      continue;
    }
    const remaining = oddsUsage().remaining;
    if (remaining !== null && remaining < ODDS_MIN_CREDITS) {
      report.skipped.push(`${key}: reserva de créditos (${remaining} < ${ODDS_MIN_CREDITS})`);
      continue;
    }
    report.sports++;
    try {
      const events = await oddsApi.sportOdds(sportKey);
      // 1) Por identificador de evento (sin comparar nombres)
      const matched = new Map<number, { id: string }>();
      const eventIds = new Set(events.map((e) => e.id));
      for (const f of fxs) if (f.odds_event_id && eventIds.has(f.odds_event_id)) matched.set(f.id, { id: f.odds_event_id });
      // 2) Los que aún no tienen evento: por nombre + hora, y se guarda el id para la próxima vez
      const unlinked = fxs.filter((f) => !f.odds_event_id);
      if (unlinked.length) {
        const byName = matchFixturesToEvents(
          unlinked.map((f) => ({ id: f.id, kickoff: f.kickoff, home: f.home.name, away: f.away.name })),
          events.filter((e) => ![...matched.values()].some((m) => m.id === e.id)),
        );
        for (const [fixtureId, ev] of byName) {
          matched.set(fixtureId, { id: ev.id });
          await admin.from('fixtures').update({ odds_event_id: ev.id }).eq('id', fixtureId);
        }
      }
      report.eventsMatched += matched.size;
      const fetchedAt = new Date().toISOString();

      for (const [fixtureId, ev] of matched) {
        const full = events.find((e) => e.id === ev.id)!;
        let quotes = normalizeEvent(full);

        // Mercados extra (BTTS, 1T) solo el día del partido
        const fx = fxs.find((f) => f.id === fixtureId)!;
        if (EXTRA_MARKETS_ENABLED && new Date(fx.kickoff) <= todayEnd) {
          const eKey = `odds-extra:${ev.id}`;
          if (await shouldFetch(admin, eKey, TTL.odds)) {
            try {
              const extra = await oddsApi.eventOdds(sportKey, ev.id);
              quotes = quotes.concat(normalizeEvent(extra));
              report.extraEvents++;
              await markFetched(admin, eKey, 'event odds');
            } catch (e) {
              report.errors.push(`${eKey}: ${(e as Error).message}`);
            }
          }
        }

        if (!quotes.length) continue;
        // Reemplazar cuotas del partido (snapshot más reciente)
        await admin.from('odds').delete().eq('fixture_id', fixtureId);
        const rows = quotes.map((q) => ({ fixture_id: fixtureId, ...q, fetched_at: fetchedAt }));
        // Deduplicar por clave única
        const seen = new Set<string>();
        const unique = rows.filter((r) => {
          const k = `${r.bookmaker}|${r.market}|${r.selection}|${r.line}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        const { error } = await admin.from('odds').insert(unique);
        if (error) throw error;
        report.quotesUpserted += unique.length;
      }
      await markFetched(admin, key, 'sport odds', events.length);
    } catch (e) {
      report.errors.push(`${key}: ${(e as Error).message}`);
    }
  }
  report.usage = oddsUsage();
  return report;
}
