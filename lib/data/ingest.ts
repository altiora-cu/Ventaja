import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Fixture, FixtureStats, League, TeamStats } from '@/lib/db/types';
import { computeLeagueElo } from '@/lib/engine/elo';
import { addDays, toDateKey } from '@/lib/utils';
import { apiFootball, statMap, type AfFixture } from './api-football';
import { computeReferees, computeTeamStats, finished } from './aggregate';
import { markFetched, shouldFetch, TTL } from './cache';
import { FINISHED_STATUSES } from './statuses';

export interface IngestReport {
  leagues: number;
  fixturesUpserted: number;
  statsFetched: number;
  playersUpdated: number;
  injuries: number;
  lineups: number;
  teamStats: number;
  skipped: string[];
  errors: string[];
}

function emptyReport(): IngestReport {
  return { leagues: 0, fixturesUpserted: 0, statsFetched: 0, playersUpdated: 0, injuries: 0, lineups: 0, teamStats: 0, skipped: [], errors: [] };
}

export async function activeLeagues(admin: SupabaseClient): Promise<League[]> {
  const { data, error } = await admin.from('leagues').select('*').eq('active', true).returns<League[]>();
  if (error) throw error;
  return data ?? [];
}

function fixtureRow(f: AfFixture, existing?: Partial<Fixture>): Omit<Fixture, 'updated_at'> & { updated_at: string } {
  return {
    id: f.fixture.id,
    league_id: f.league.id,
    season: f.league.season,
    round: f.league.round,
    kickoff: f.fixture.date,
    home_id: f.teams.home.id,
    away_id: f.teams.away.id,
    venue: f.fixture.venue?.name ?? null,
    city: f.fixture.venue?.city ?? null,
    referee: f.fixture.referee,
    status: f.fixture.status.short,
    home_goals: f.goals.home,
    away_goals: f.goals.away,
    ht_home_goals: f.score.halftime?.home ?? null,
    ht_away_goals: f.score.halftime?.away ?? null,
    stats: existing?.stats ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertTeamsAndFixtures(admin: SupabaseClient, fixtures: AfFixture[], leagueLogo?: Map<number, string>): Promise<number> {
  if (!fixtures.length) return 0;
  const teams = new Map<number, { id: number; name: string; logo: string | null; country: string | null }>();
  for (const f of fixtures) {
    teams.set(f.teams.home.id, { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo, country: f.league.country });
    teams.set(f.teams.away.id, { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo, country: f.league.country });
    if (leagueLogo && f.league.logo) leagueLogo.set(f.league.id, f.league.logo);
  }
  const { error: tErr } = await admin.from('teams').upsert([...teams.values()], { onConflict: 'id' });
  if (tErr) throw tErr;

  // Conservar stats ya guardadas
  const ids = fixtures.map((f) => f.fixture.id);
  const { data: existing } = await admin.from('fixtures').select('id,stats').in('id', ids).returns<Array<{ id: number; stats: FixtureStats | null }>>();
  const existingMap = new Map((existing ?? []).map((e) => [e.id, e]));

  const rows = fixtures.map((f) => fixtureRow(f, existingMap.get(f.fixture.id)));
  const { error } = await admin.from('fixtures').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

/** Partidos de los próximos 7 días + resultados de ayer/hoy para las ligas activas. */
export async function ingestFixtures(days = 7): Promise<IngestReport> {
  const admin = createAdminClient();
  const report = emptyReport();
  const leagues = await activeLeagues(admin);
  report.leagues = leagues.length;
  const now = new Date();
  const from = toDateKey(addDays(now, -1), 'UTC');
  const to = toDateKey(addDays(now, days), 'UTC');
  const leagueLogo = new Map<number, string>();

  for (const league of leagues) {
    const key = `fixtures:${league.id}:${from}:${to}`;
    if (!(await shouldFetch(admin, key, TTL.fixtures))) {
      report.skipped.push(key);
      continue;
    }
    try {
      const fixtures = await apiFootball.fixturesByRange(league.id, league.season, from, to);
      report.fixturesUpserted += await upsertTeamsAndFixtures(admin, fixtures, leagueLogo);
      await markFetched(admin, key, 'fixtures range', fixtures.length);
    } catch (e) {
      report.errors.push(`${key}: ${(e as Error).message}`);
    }
  }
  for (const [id, logo] of leagueLogo) await admin.from('leagues').update({ logo }).eq('id', id);

  // Estadísticas reales de partidos terminados sin stats (una sola vez por partido)
  report.statsFetched = await fetchMissingFixtureStats(admin, report, 60);
  return report;
}

/** Descarga estadísticas (corners, tarjetas, tiros, xG, jugadores) de partidos terminados que aún no las tienen. */
export async function fetchMissingFixtureStats(admin: SupabaseClient, report: IngestReport, limit = 60): Promise<number> {
  const { data: pending } = await admin
    .from('fixtures')
    .select('id,home_id,away_id')
    .in('status', [...FINISHED_STATUSES])
    .is('stats', null)
    .order('kickoff', { ascending: false })
    .limit(limit)
    .returns<Array<{ id: number; home_id: number; away_id: number }>>();

  let n = 0;
  for (const f of pending ?? []) {
    const key = `fixture-stats:${f.id}`;
    if (!(await shouldFetch(admin, key, TTL.forever))) continue;
    try {
      const [stats, players] = await Promise.all([apiFootball.fixtureStatistics(f.id), apiFootball.fixturePlayers(f.id).catch(() => [])]);
      const byTeam = new Map(stats.map((s) => [s.team.id, statMap(s.statistics)]));
      const h = byTeam.get(f.home_id) ?? {};
      const a = byTeam.get(f.away_id) ?? {};
      const pick = (hKey: string): { home: number; away: number } | undefined =>
        h[hKey] !== undefined || a[hKey] !== undefined ? { home: h[hKey] ?? 0, away: a[hKey] ?? 0 } : undefined;
      const fs: FixtureStats = {
        corners: pick('Corner Kicks'),
        yellow: pick('Yellow Cards'),
        red: pick('Red Cards'),
        shots: pick('Total Shots'),
        sot: pick('Shots on Goal'),
        xg: pick('expected_goals'),
        players: players.flatMap((tp) =>
          tp.players.map((p) => ({
            player_id: p.player.id,
            team_id: tp.team.id,
            goals: p.statistics[0]?.goals.total ?? 0,
            sot: p.statistics[0]?.shots.on ?? 0,
            minutes: p.statistics[0]?.games.minutes ?? 0,
          })),
        ),
      };
      if (fs.yellow || fs.red) fs.cards = { home: (fs.yellow?.home ?? 0) + (fs.red?.home ?? 0), away: (fs.yellow?.away ?? 0) + (fs.red?.away ?? 0) };
      // Si la API no devolvió nada (partido sin cobertura), guardamos {} para no reintentar.
      await admin.from('fixtures').update({ stats: stats.length ? fs : {} }).eq('id', f.id);
      await markFetched(admin, key, 'fixture statistics', stats.length);
      n++;
    } catch (e) {
      report.errors.push(`${key}: ${(e as Error).message}`);
    }
  }
  return n;
}

/**
 * Estadísticas de equipo/jugador/árbitro de las 7 ligas.
 * - Asegura el calendario completo de la temporada (1 llamada por liga, cacheada 20 h).
 * - Recalcula team_stats, Elo y árbitros desde nuestros fixtures (sin llamadas).
 * - Jugadores por liga (paginado, cacheado 20 h). Lesiones del día por liga.
 */
export async function ingestStats(): Promise<IngestReport> {
  const admin = createAdminClient();
  const report = emptyReport();
  const leagues = await activeLeagues(admin);
  report.leagues = leagues.length;

  for (const league of leagues) {
    const seasonKey = `season:${league.id}:${league.season}`;
    if (await shouldFetch(admin, seasonKey, TTL.stats)) {
      try {
        const fixtures = await apiFootball.fixturesBySeason(league.id, league.season);
        report.fixturesUpserted += await upsertTeamsAndFixtures(admin, fixtures);
        await markFetched(admin, seasonKey, 'season fixtures', fixtures.length);
      } catch (e) {
        report.errors.push(`${seasonKey}: ${(e as Error).message}`);
      }
    } else report.skipped.push(seasonKey);
  }

  report.statsFetched = await fetchMissingFixtureStats(admin, report, 120);

  for (const league of leagues) {
    // Jugadores
    const pKey = `players:${league.id}:${league.season}`;
    if (await shouldFetch(admin, pKey, TTL.players)) {
      try {
        const players = await apiFootball.players(league.id, league.season);
        const rows = players.flatMap((p) =>
          p.statistics
            .filter((s) => s.league.id === league.id && (s.games.minutes ?? 0) > 0)
            .map((s) => ({
              player_id: p.player.id,
              team_id: s.team.id,
              league_id: league.id,
              season: league.season,
              name: p.player.name,
              position: s.games.position,
              photo: p.player.photo,
              appearances: s.games.appearences ?? 0,
              lineups: s.games.lineups ?? 0,
              minutes: s.games.minutes ?? 0,
              goals: s.goals.total ?? 0,
              xg: null,
              shots: s.shots.total,
              sot: s.shots.on,
              updated_at: new Date().toISOString(),
            })),
        );
        // Asegurar equipos referenciados
        const teamIds = [...new Set(rows.map((r) => r.team_id))];
        const { data: known } = await admin.from('teams').select('id').in('id', teamIds).returns<Array<{ id: number }>>();
        const knownSet = new Set((known ?? []).map((k) => k.id));
        const safeRows = rows.filter((r) => knownSet.has(r.team_id));
        for (let i = 0; i < safeRows.length; i += 500) {
          const { error } = await admin.from('player_stats').upsert(safeRows.slice(i, i + 500), { onConflict: 'player_id,team_id,league_id,season' });
          if (error) throw error;
        }
        report.playersUpdated += safeRows.length;
        await markFetched(admin, pKey, 'players', rows.length);
      } catch (e) {
        report.errors.push(`${pKey}: ${(e as Error).message}`);
      }
    } else report.skipped.push(pKey);

    // Lesiones de hoy y mañana
    for (const d of [0, 1]) {
      const date = toDateKey(addDays(new Date(), d), 'UTC');
      const iKey = `injuries:${league.id}:${date}`;
      if (!(await shouldFetch(admin, iKey, TTL.injuries))) continue;
      try {
        const inj = await apiFootball.injuriesByLeagueDate(league.id, league.season, date);
        const fixtureIds = [...new Set(inj.map((i) => i.fixture.id))];
        if (fixtureIds.length) {
          const { data: known } = await admin.from('fixtures').select('id').in('id', fixtureIds).returns<Array<{ id: number }>>();
          const knownSet = new Set((known ?? []).map((k) => k.id));
          const rows = inj
            .filter((i) => knownSet.has(i.fixture.id))
            .map((i) => ({ fixture_id: i.fixture.id, team_id: i.team.id, player_id: i.player.id, player_name: i.player.name, type: i.player.type, reason: i.player.reason, updated_at: new Date().toISOString() }));
          if (rows.length) {
            const { error } = await admin.from('injuries').upsert(rows, { onConflict: 'fixture_id,team_id,player_id' });
            if (error) throw error;
            report.injuries += rows.length;
          }
        }
        await markFetched(admin, iKey, 'injuries', inj.length);
      } catch (e) {
        report.errors.push(`${iKey}: ${(e as Error).message}`);
      }
    }
  }

  report.teamStats = await recomputeTeamStats(admin, leagues);
  return report;
}

/** Recalcula team_stats, Elo y árbitros desde la tabla fixtures (sin llamadas externas). */
export async function recomputeTeamStats(admin: SupabaseClient, leagues: League[]): Promise<number> {
  let count = 0;
  const allFixtures: Fixture[] = [];
  for (const league of leagues) {
    const { data: fixtures } = await admin.from('fixtures').select('*').eq('league_id', league.id).eq('season', league.season).returns<Fixture[]>();
    if (!fixtures?.length) continue;
    allFixtures.push(...fixtures);

    const done = finished(fixtures).sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    const elo = computeLeagueElo(done);
    const teamIds = new Set<number>();
    for (const f of fixtures) {
      teamIds.add(f.home_id);
      teamIds.add(f.away_id);
    }
    const rows: TeamStats[] = [...teamIds].map((id) => computeTeamStats(fixtures, id, league.id, league.season, elo.get(id) ?? 1500));
    const { error } = await admin.from('team_stats').upsert(rows, { onConflict: 'team_id,league_id,season' });
    if (error) throw error;
    count += rows.length;
  }
  const refs = computeReferees(allFixtures);
  if (refs.length) {
    await admin.from('referees').upsert(refs.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'name' });
  }
  return count;
}

/** Alineaciones confirmadas de los partidos de las próximas 2 horas (para minutos esperados y bajas). */
export async function ingestLineups(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();
  const { data: soon } = await admin
    .from('fixtures')
    .select('id')
    .gte('kickoff', new Date(now.getTime() - 30 * 60_000).toISOString())
    .lte('kickoff', new Date(now.getTime() + 2 * 3600_000).toISOString())
    .returns<Array<{ id: number }>>();
  let n = 0;
  for (const f of soon ?? []) {
    const key = `lineups:${f.id}`;
    if (!(await shouldFetch(admin, key, TTL.lineups))) continue;
    try {
      const lineups = await apiFootball.fixtureLineups(f.id);
      if (lineups.length) {
        await admin.from('lineups').upsert(
          lineups.map((l) => ({
            fixture_id: f.id,
            team_id: l.team.id,
            formation: l.formation,
            starters: l.startXI.map((p) => ({ player_id: p.player.id, name: p.player.name, pos: p.player.pos })),
            bench: l.substitutes.map((p) => ({ player_id: p.player.id, name: p.player.name, pos: p.player.pos })),
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'fixture_id,team_id' },
        );
        n += lineups.length;
      }
      await markFetched(admin, key, 'lineups', lineups.length);
    } catch {
      // alineaciones aún no publicadas: reintentar en el próximo ciclo
    }
  }
  return n;
}
