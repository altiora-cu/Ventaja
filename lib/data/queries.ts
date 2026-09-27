import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/admin';
import type { FixtureAnalysis, FixtureFull, Injury, League, Odd, PickHistory, Prediction, Profile, Team, TeamStats } from '@/lib/db/types';
import { qualifiesAsPick } from '@/lib/engine/edge';
import { FINISHED_STATUSES } from './statuses';
import { DEFAULT_TZ, zonedStartOfDay } from '@/lib/tz';

const FIXTURE_SELECT = '*,home:teams!fixtures_home_id_fkey(*),away:teams!fixtures_away_id_fkey(*),league:leagues(*)';

export interface Probs1x2 {
  home: number;
  draw: number;
  away: number;
}
export type FixtureWithAnalysis = FixtureFull & {
  analysis: FixtureAnalysis | null;
  pick: PickHistory | null;
  homeForm: string | null;
  awayForm: string | null;
  probs: Probs1x2 | null;
};

function db() {
  return createClient();
}

/** Ventana [00:00, 24:00) de una fecha AAAA-MM-DD en la zona horaria del usuario (ET por defecto). */
export function dayRange(dateKey: string, timeZone = DEFAULT_TZ): { from: string; to: string } {
  const from = zonedStartOfDay(dateKey, timeZone);
  const to = zonedStartOfDay(nextDayKey(dateKey), timeZone);
  return { from: from.toISOString(), to: to.toISOString() };
}

function nextDayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export const getLeagues = cache(async (): Promise<League[]> => {
  if (!hasSupabaseEnv()) return [];
  const { data } = await db().from('leagues').select('*').eq('active', true).order('name').returns<League[]>();
  return data ?? [];
});

export const getFixturesForDate = cache(async (dateKey: string, leagueId?: number, timeZone = DEFAULT_TZ): Promise<FixtureWithAnalysis[]> => {
  if (!hasSupabaseEnv()) return [];
  const { from, to } = dayRange(dateKey, timeZone);
  let q = db().from('fixtures').select(FIXTURE_SELECT).gte('kickoff', from).lt('kickoff', to).order('kickoff');
  if (leagueId) q = q.eq('league_id', leagueId);
  const { data: fixtures } = await q.returns<FixtureFull[]>();
  if (!fixtures?.length) return [];
  const ids = fixtures.map((f) => f.id);
  const teamIds = [...new Set(fixtures.flatMap((f) => [f.home_id, f.away_id]))];
  const [{ data: analyses }, { data: picks }, { data: stats }, { data: preds }] = await Promise.all([
    db().from('fixture_analysis').select('*').in('fixture_id', ids).returns<FixtureAnalysis[]>(),
    db().from('picks_history').select('*').in('fixture_id', ids).returns<PickHistory[]>(),
    db().from('team_stats').select('team_id,league_id,form,played').in('team_id', teamIds).returns<Array<{ team_id: number; league_id: number; form: string | null; played: number }>>(),
    db().from('predictions').select('fixture_id,selection,prob').in('fixture_id', ids).eq('market', '1x2').returns<Array<{ fixture_id: number; selection: string; prob: number }>>(),
  ]);
  const aMap = new Map((analyses ?? []).map((a) => [a.fixture_id, a]));
  const pMap = new Map<number, PickHistory>();
  for (const p of picks ?? []) {
    const cur = pMap.get(p.fixture_id);
    if (!cur || rank(p.sello) > rank(cur.sello)) pMap.set(p.fixture_id, p);
  }
  const formFor = (teamId: number, leagueId: number): string | null => {
    const rows = (stats ?? []).filter((s) => s.team_id === teamId);
    return (rows.find((s) => s.league_id === leagueId) ?? rows.sort((a, b) => b.played - a.played)[0])?.form ?? null;
  };
  const probs = new Map<number, Probs1x2>();
  for (const p of preds ?? []) {
    const e = probs.get(p.fixture_id) ?? { home: 0, draw: 0, away: 0 };
    (e as unknown as Record<string, number>)[p.selection] = Number(p.prob);
    probs.set(p.fixture_id, e);
  }
  return fixtures.map((f) => ({
    ...f,
    analysis: aMap.get(f.id) ?? null,
    pick: pMap.get(f.id) ?? null,
    homeForm: formFor(f.home_id, f.league_id),
    awayForm: formFor(f.away_id, f.league_id),
    probs: probs.get(f.id) ?? null,
  }));
});

function rank(s: string): number {
  return s === 'alta' ? 3 : s === 'media' ? 2 : 1;
}

export interface FixtureDetail {
  fixture: FixtureFull;
  analysis: FixtureAnalysis | null;
  predictions: Prediction[];
  odds: Odd[];
  injuries: Injury[];
  homeStats: TeamStats | null;
  awayStats: TeamStats | null;
  referee: { name: string; cards_avg: number | null } | null;
  teamHistory: { home: PickHistory[]; away: PickHistory[] };
  picks: PickHistory[];
}

export const getFixtureDetail = cache(async (id: number): Promise<FixtureDetail | null> => {
  if (!hasSupabaseEnv()) return null;
  const { data: fixture } = await db().from('fixtures').select(FIXTURE_SELECT).eq('id', id).maybeSingle<FixtureFull>();
  if (!fixture) return null;
  const refName = fixture.referee?.split(',')[0].trim();
  const [{ data: analysis }, { data: predictions }, { data: odds }, { data: injuries }, { data: stats }, referee, { data: hist }, { data: picks }] = await Promise.all([
    db().from('fixture_analysis').select('*').eq('fixture_id', id).maybeSingle<FixtureAnalysis>(),
    db().from('predictions').select('*').eq('fixture_id', id).order('edge', { ascending: false, nullsFirst: false }).returns<Prediction[]>(),
    db().from('odds').select('*').eq('fixture_id', id).returns<Odd[]>(),
    db().from('injuries').select('*').eq('fixture_id', id).returns<Injury[]>(),
    db().from('team_stats').select('*').in('team_id', [fixture.home_id, fixture.away_id]).eq('league_id', fixture.league_id).returns<TeamStats[]>(),
    refName ? db().from('referees').select('name,cards_avg').eq('name', refName).maybeSingle<{ name: string; cards_avg: number | null }>() : Promise.resolve({ data: null }),
    db()
      .from('picks_history')
      .select('*,fixture:fixtures!inner(home_id,away_id,kickoff)')
      .or(`fixture.home_id.in.(${fixture.home_id},${fixture.away_id}),fixture.away_id.in.(${fixture.home_id},${fixture.away_id})`)
      .order('settled_at', { ascending: false })
      .limit(40)
      .returns<Array<PickHistory & { fixture: { home_id: number; away_id: number; kickoff: string } }>>(),
    db().from('picks_history').select('*').eq('fixture_id', id).returns<PickHistory[]>(),
  ]);
  const homeH = (hist ?? []).filter((h) => h.fixture.home_id === fixture.home_id || h.fixture.away_id === fixture.home_id).slice(0, 10);
  const awayH = (hist ?? []).filter((h) => h.fixture.home_id === fixture.away_id || h.fixture.away_id === fixture.away_id).slice(0, 10);
  return {
    fixture,
    analysis: analysis ?? null,
    predictions: predictions ?? [],
    odds: odds ?? [],
    injuries: injuries ?? [],
    homeStats: (stats ?? []).find((s) => s.team_id === fixture.home_id) ?? null,
    awayStats: (stats ?? []).find((s) => s.team_id === fixture.away_id) ?? null,
    referee: referee.data ?? null,
    teamHistory: { home: homeH, away: awayH },
    picks: picks ?? [],
  };
});

export interface PickCandidate extends Prediction {
  fixture: FixtureFull;
}

/** Selecciones del día que cumplen el umbral (ventaja ≥ 5%, prob ≥ 55%), ordenadas por ventaja. */
export const getPickCandidates = cache(async (dateKey: string, timeZone = DEFAULT_TZ): Promise<PickCandidate[]> => {
  if (!hasSupabaseEnv()) return [];
  const { from, to } = dayRange(dateKey, timeZone);
  const { data: fixtures } = await db().from('fixtures').select(FIXTURE_SELECT).gte('kickoff', from).lt('kickoff', to).in('status', ['NS', 'TBD']).returns<FixtureFull[]>();
  if (!fixtures?.length) return [];
  const fMap = new Map(fixtures.map((f) => [f.id, f]));
  const { data: preds } = await db()
    .from('predictions')
    .select('*')
    .in('fixture_id', fixtures.map((f) => f.id))
    .gte('edge', 0.05)
    .gte('prob', 0.55)
    .order('edge', { ascending: false })
    .returns<Prediction[]>();
  return (preds ?? []).filter((p) => qualifiesAsPick({ prob: Number(p.prob), edge: p.edge === null ? null : Number(p.edge) })).map((p) => ({ ...p, fixture: fMap.get(p.fixture_id)! }));
});

export interface SearchResult extends FixtureFull {
  analysis: FixtureAnalysis | null;
  pick: PickHistory | null;
}

export async function searchFixtures(q: string): Promise<SearchResult[]> {
  if (!hasSupabaseEnv()) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  let fixtures: FixtureFull[] = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(term)) {
    const { from, to } = dayRange(term);
    const { data } = await db().from('fixtures').select(FIXTURE_SELECT).gte('kickoff', from).lt('kickoff', to).order('kickoff').limit(60).returns<FixtureFull[]>();
    fixtures = data ?? [];
  } else {
    const pattern = `%${term.replace(/[%_]/g, '')}%`;
    const [{ data: teams }, { data: leagues }] = await Promise.all([
      db().from('teams').select('id').ilike('name', pattern).limit(20).returns<Array<{ id: number }>>(),
      db().from('leagues').select('id').ilike('name', pattern).limit(5).returns<Array<{ id: number }>>(),
    ]);
    const teamIds = (teams ?? []).map((t) => t.id);
    const leagueIds = (leagues ?? []).map((l) => l.id);
    if (!teamIds.length && !leagueIds.length) return [];
    const ors: string[] = [];
    if (teamIds.length) ors.push(`home_id.in.(${teamIds.join(',')})`, `away_id.in.(${teamIds.join(',')})`);
    if (leagueIds.length) ors.push(`league_id.in.(${leagueIds.join(',')})`);
    const now = new Date();
    const { data } = await db()
      .from('fixtures')
      .select(FIXTURE_SELECT)
      .or(ors.join(','))
      .gte('kickoff', new Date(now.getTime() - 60 * 86_400_000).toISOString())
      .lte('kickoff', new Date(now.getTime() + 21 * 86_400_000).toISOString())
      .order('kickoff', { ascending: false })
      .limit(60)
      .returns<FixtureFull[]>();
    fixtures = data ?? [];
  }
  if (!fixtures.length) return [];
  const ids = fixtures.map((f) => f.id);
  const [{ data: analyses }, { data: picks }] = await Promise.all([
    db().from('fixture_analysis').select('*').in('fixture_id', ids).returns<FixtureAnalysis[]>(),
    db().from('picks_history').select('*').in('fixture_id', ids).returns<PickHistory[]>(),
  ]);
  const aMap = new Map((analyses ?? []).map((a) => [a.fixture_id, a]));
  const pMap = new Map<number, PickHistory>();
  for (const p of picks ?? []) {
    const cur = pMap.get(p.fixture_id);
    if (!cur || rank(p.sello) > rank(cur.sello)) pMap.set(p.fixture_id, p);
  }
  return fixtures.map((f) => ({ ...f, analysis: aMap.get(f.id) ?? null, pick: pMap.get(f.id) ?? null }));
}

export interface HistorialData {
  picks: Array<PickHistory & { fixture: FixtureFull }>;
  total: number;
  pending: number;
  hitRate: number | null;
  roi: number | null;
  streak: { kind: 'acierto' | 'fallo' | null; count: number };
  byMarket: Array<{ market: string; n: number; hitRate: number }>;
  series: Array<{ date: string; units: number }>;
}

export const getHistorial = cache(async (limit = 200): Promise<HistorialData> => {
  const empty: HistorialData = { picks: [], total: 0, pending: 0, hitRate: null, roi: null, streak: { kind: null, count: 0 }, byMarket: [], series: [] };
  if (!hasSupabaseEnv()) return empty;
  const { data: picks } = await db()
    .from('picks_history')
    .select(`*,fixture:fixtures(${FIXTURE_SELECT})`)
    .order('settled_at', { ascending: false })
    .limit(limit)
    .returns<Array<PickHistory & { fixture: FixtureFull }>>();
  const all = picks ?? [];
  const decided = all.filter((p) => p.result !== 'nulo');
  const hits = decided.filter((p) => p.result === 'acierto').length;
  const staked = decided.length;
  const units = all.reduce((s, p) => s + Number(p.units), 0);

  let streakKind: 'acierto' | 'fallo' | null = null;
  let streak = 0;
  for (const p of all) {
    if (p.result === 'nulo') continue;
    if (!streakKind) streakKind = p.result;
    if (p.result === streakKind) streak++;
    else break;
  }

  const byMarketMap = new Map<string, { n: number; hits: number }>();
  for (const p of decided) {
    const e = byMarketMap.get(p.market) ?? { n: 0, hits: 0 };
    e.n++;
    if (p.result === 'acierto') e.hits++;
    byMarketMap.set(p.market, e);
  }

  // Serie acumulada (orden cronológico) agrupada por día
  const chrono = [...all].sort((a, b) => new Date(a.settled_at).getTime() - new Date(b.settled_at).getTime());
  const byDay = new Map<string, number>();
  for (const p of chrono) {
    const day = p.fixture?.kickoff?.slice(0, 10) ?? p.settled_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(p.units));
  }
  let acc = 0;
  const series = [...byDay.entries()].map(([date, u]) => {
    acc += u;
    return { date, units: Math.round(acc * 100) / 100 };
  });

  const { count: pending } = await db().from('predictions').select('fixture_id', { count: 'exact', head: true }).in('sello', ['alta', 'media']);

  return {
    picks: all,
    total: all.length,
    pending: pending ?? 0,
    hitRate: staked ? hits / staked : null,
    roi: staked ? units / staked : null,
    streak: { kind: streakKind, count: streak },
    byMarket: [...byMarketMap.entries()].map(([market, { n, hits: h }]) => ({ market, n, hitRate: h / n })).sort((a, b) => b.n - a.n),
    series,
  };
});

export const getProfiles = cache(async (q?: string): Promise<Profile[]> => {
  if (!hasSupabaseEnv()) return [];
  let query = db().from('profiles').select('*').order('created_at', { ascending: false }).limit(500);
  if (q) query = query.ilike('email', `%${q}%`);
  const { data } = await query.returns<Profile[]>();
  return data ?? [];
});

export function isFinishedStatus(status: string): boolean {
  return FINISHED_STATUSES.has(status);
}

export type { Team };
