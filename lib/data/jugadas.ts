import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/admin';
import type { FixtureFull, Prediction, SystemCombo, UserCombo, UserPick } from '@/lib/db/types';
import { qualifiesAsPick, selectionKey } from '@/lib/engine/edge';
import type { AiReview, Sello } from '@/lib/db/types';
import { summarizePlays, type PlaySummary } from './play-stats';

const FIXTURE_SELECT = '*,home:teams!fixtures_home_id_fkey(*),away:teams!fixtures_away_id_fkey(*),league:leagues(*)';
const USER_PLAYS_LIMIT = 300;
const USER_COMBOS_LIMIT = 100;
const OPEN_PICKS_DAYS = 4;
const DAY_MS = 86_400_000;

export type UserPickFull = UserPick & { fixture: FixtureFull | null };
export type UserComboFull = UserCombo & { legs: UserPickFull[] };

export interface UserPlaysData {
  singles: UserPickFull[];
  combos: UserComboFull[];
  singlesSummary: PlaySummary;
  combosSummary: PlaySummary;
  /** Jugadas sueltas y combinadas juntas: el porcentaje de victoria global del usuario. */
  overall: PlaySummary;
}

/** Clave de una selección, igual en servidor y cliente, para saber si ya está marcada. */
export function playKey(p: Pick<Prediction, 'market' | 'selection' | 'line' | 'player_id'>): string {
  return selectionKey(p.market, p.selection, p.line === null ? null : Number(p.line), p.player_id);
}

/** Jugadas y combinadas del usuario con sesión (RLS devuelve solo las suyas). */
export const getUserPlays = cache(async (userId: string): Promise<UserPlaysData> => {
  const empty = summarizePlays([]);
  if (!hasSupabaseEnv()) return { singles: [], combos: [], singlesSummary: empty, combosSummary: empty, overall: empty };
  const supabase = createClient();
  const picksOf = () => supabase.from('user_picks').select(`*,fixture:fixtures(${FIXTURE_SELECT})`).eq('user_id', userId);
  const [{ data: singleRows }, { data: combos }] = await Promise.all([
    picksOf().is('combo_id', null).order('created_at', { ascending: false }).limit(USER_PLAYS_LIMIT).returns<UserPickFull[]>(),
    supabase.from('user_combos').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(USER_COMBOS_LIMIT).returns<UserCombo[]>(),
  ]);
  const comboIds = (combos ?? []).map((c) => c.id);
  const { data: legRows } = comboIds.length ? await picksOf().in('combo_id', comboIds).order('id').returns<UserPickFull[]>() : { data: [] };
  const singles = singleRows ?? [];
  const combosFull = (combos ?? []).map((c) => ({ ...c, legs: (legRows ?? []).filter((p) => p.combo_id === c.id) }));
  return {
    singles,
    combos: combosFull,
    singlesSummary: summarizePlays(singles),
    combosSummary: summarizePlays(combosFull),
    overall: summarizePlays([...singles, ...combosFull]),
  };
});

/** Claves de las jugadas sueltas que el usuario ya marcó en estos partidos. */
export const getMarkedKeys = cache(async (userId: string | null, fixtureIds: number[]): Promise<Record<number, string[]>> => {
  if (!userId || !fixtureIds.length || !hasSupabaseEnv()) return {};
  const { data } = await createClient()
    .from('user_picks')
    .select('fixture_id,market,selection,line,player_id')
    .eq('user_id', userId)
    .is('combo_id', null)
    .in('fixture_id', fixtureIds)
    .returns<Array<Pick<UserPick, 'fixture_id' | 'market' | 'selection' | 'line' | 'player_id'>>>();
  const out: Record<number, string[]> = {};
  for (const row of data ?? []) out[row.fixture_id] = [...(out[row.fixture_id] ?? []), playKey(row)];
  return out;
});

/** Ids de las predicciones que el usuario ya tiene marcadas como jugada suelta. */
export async function getMarkedPredictionIds(userId: string | null, preds: ReadonlyArray<Pick<Prediction, 'id' | 'fixture_id' | 'market' | 'selection' | 'line' | 'player_id'>>): Promise<number[]> {
  const keys = await getMarkedKeys(userId, [...new Set(preds.map((p) => p.fixture_id))].sort((a, b) => a - b));
  return preds.filter((p) => keys[p.fixture_id]?.includes(playKey(p))).map((p) => p.id);
}

export type OpenSystemPick =Prediction & { fixture: FixtureFull };

/** Picks del sistema que cumplen el umbral y cuyo partido aún no se juega: lo que el historial cerrará después. */
export const getOpenSystemPicks = cache(async (): Promise<OpenSystemPick[]> => {
  if (!hasSupabaseEnv()) return [];
  const supabase = createClient();
  const now = Date.now();
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(FIXTURE_SELECT)
    .gte('kickoff', new Date(now).toISOString())
    .lte('kickoff', new Date(now + OPEN_PICKS_DAYS * DAY_MS).toISOString())
    .in('status', ['NS', 'TBD'])
    .order('kickoff')
    .returns<FixtureFull[]>();
  if (!fixtures?.length) return [];
  const fixtureMap = new Map(fixtures.map((f) => [f.id, f]));
  const { data: preds } = await supabase
    .from('predictions')
    .select('*')
    .in('fixture_id', fixtures.map((f) => f.id))
    .in('sello', ['alta', 'media'])
    .order('edge', { ascending: false })
    .returns<Prediction[]>();
  return (preds ?? [])
    .filter((p) => qualifiesAsPick({ prob: Number(p.prob), edge: p.edge === null ? null : Number(p.edge) }))
    .map((p) => ({ ...p, fixture: fixtureMap.get(p.fixture_id)! }))
    .sort((a, b) => new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime());
});

export interface SystemCombosData {
  combos: SystemCombo[];
  summary: PlaySummary;
}

/** Combinadas registradas por el sistema, las más recientes primero. Las que siguen en juego solo llegan si el visitante tiene acceso (RLS). */
export const getSystemCombos = cache(async (limit = 60): Promise<SystemCombosData> => {
  if (!hasSupabaseEnv()) return { combos: [], summary: summarizePlays([]) };
  const { data } = await createClient().from('system_combos').select('*').order('date_key', { ascending: false }).order('id').limit(limit).returns<SystemCombo[]>();
  const combos = data ?? [];
  return { combos, summary: summarizePlays(combos) };
});

export interface OpenPlay {
  id: number;
  fixtureId: number;
  home: string;
  away: string;
  kickoff: string;
  market: string;
  selection: string;
  line: number | null;
  playerId: number | null;
  playerName: string | null;
  prob: number;
  price: number | null;
<<<<<<< HEAD
  sello: Sello;
  stake: number | null;
  /** Por qué el modelo no la recomienda: sello BAJA o la Revisión IA discrepa. null si está bien. */
  warning: 'baja' | 'discrepa' | null;
=======
>>>>>>> origin/claude/jolly-gates-fz5jss
}

export interface OpenPlaysSummary {
  /** Jugadas sueltas marcadas cuyo partido aún no empezó, de la más próxima a la más lejana. */
  plays: OpenPlay[];
  /** Combinadas guardadas que siguen sin resultado. */
  openCombos: number;
}

<<<<<<< HEAD
type OpenPlayRow = Pick<UserPick, 'id' | 'fixture_id' | 'market' | 'selection' | 'line' | 'player_id' | 'player_name' | 'prob' | 'price' | 'sello' | 'stake'> & {
=======
type OpenPlayRow = Pick<UserPick, 'id' | 'fixture_id' | 'market' | 'selection' | 'line' | 'player_id' | 'player_name' | 'prob' | 'price'> & {
>>>>>>> origin/claude/jolly-gates-fz5jss
  fixture: { id: number; kickoff: string; status: string; home: { name: string }; away: { name: string } } | null;
};

/** Resumen ligero para la burbuja flotante: solo lo que sigue en juego, sin historial. */
export const getOpenPlays = cache(async (userId: string): Promise<OpenPlaysSummary> => {
  if (!hasSupabaseEnv()) return { plays: [], openCombos: 0 };
  const supabase = createClient();
  const now = Date.now();
  const [{ data: rows }, { count }] = await Promise.all([
    supabase
      .from('user_picks')
<<<<<<< HEAD
      .select('id,fixture_id,market,selection,line,player_id,player_name,prob,price,sello,stake,fixture:fixtures(id,kickoff,status,home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name))')
=======
      .select('id,fixture_id,market,selection,line,player_id,player_name,prob,price,fixture:fixtures(id,kickoff,status,home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name))')
>>>>>>> origin/claude/jolly-gates-fz5jss
      .eq('user_id', userId)
      .is('combo_id', null)
      .is('result', null)
      .limit(USER_PLAYS_LIMIT)
      .returns<OpenPlayRow[]>(),
    supabase.from('user_combos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('result', null),
  ]);
<<<<<<< HEAD
  const open = (rows ?? [])
    .filter((r): r is OpenPlayRow & { fixture: NonNullable<OpenPlayRow['fixture']> } => r.fixture !== null && ['NS', 'TBD'].includes(r.fixture.status) && new Date(r.fixture.kickoff).getTime() > now)
    .sort((a, b) => new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime());
  // Veredictos de la Revisión IA de esos partidos: una jugada con "discrepa" se avisa como no recomendada.
  const fixtureIds = [...new Set(open.map((r) => r.fixture.id))];
  const { data: analyses } = fixtureIds.length
    ? await supabase.from('fixture_analysis').select('fixture_id,ai_review').in('fixture_id', fixtureIds).returns<Array<{ fixture_id: number; ai_review: AiReview | null }>>()
    : { data: [] };
  const discrepa = new Set<string>();
  for (const a of analyses ?? []) for (const pl of a.ai_review?.plays ?? []) if (pl.verdict === 'discrepa') discrepa.add(`${a.fixture_id}|${pl.key}`);
  const plays = open.map((r) => ({
=======
  const plays = (rows ?? [])
    .filter((r): r is OpenPlayRow & { fixture: NonNullable<OpenPlayRow['fixture']> } => r.fixture !== null && ['NS', 'TBD'].includes(r.fixture.status) && new Date(r.fixture.kickoff).getTime() > now)
    .sort((a, b) => new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime())
    .map((r) => ({
>>>>>>> origin/claude/jolly-gates-fz5jss
      id: r.id,
      fixtureId: r.fixture.id,
      home: r.fixture.home.name,
      away: r.fixture.away.name,
      kickoff: r.fixture.kickoff,
      market: r.market,
      selection: r.selection,
      line: r.line === null ? null : Number(r.line),
      playerId: r.player_id,
      playerName: r.player_name,
      prob: Number(r.prob),
      price: r.price === null ? null : Number(r.price),
<<<<<<< HEAD
      sello: r.sello,
      stake: r.stake === null ? null : Number(r.stake),
      warning: (r.sello === 'baja' ? 'baja' : discrepa.has(`${r.fixture.id}|${playKey(r)}`) ? 'discrepa' : null) as OpenPlay['warning'],
=======
>>>>>>> origin/claude/jolly-gates-fz5jss
    }));
  return { plays, openCombos: count ?? 0 };
});
