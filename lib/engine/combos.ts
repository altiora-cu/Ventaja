import { qualifiesAsPick } from './edge';

export interface ComboSelection {
  fixture_id: number;
  label?: string;
  market: string;
  selection: string;
  line: number | null;
  player_name?: string | null;
  prob: number;
  price: number;
  edge: number;
  sello: 'alta' | 'media' | 'baja';
}

export type ComboKind = 'segura' | 'equilibrada' | 'ambiciosa';

export const COMBO_RULES: Record<ComboKind, { size: number; minJointProb: number }> = {
  segura: { size: 2, minJointProb: 0.45 },
  equilibrada: { size: 3, minJointProb: 0.3 },
  ambiciosa: { size: 4, minJointProb: 0.18 },
};

export interface Combo {
  kind: ComboKind;
  selections: ComboSelection[];
  jointProb: number;
  totalPrice: number;
}

/** Una selección por partido: la de mayor ventaja que cumpla el umbral. */
export function bestPerFixture(cands: ComboSelection[]): ComboSelection[] {
  const byFixture = new Map<number, ComboSelection>();
  for (const c of cands) {
    if (!qualifiesAsPick(c)) continue;
    const cur = byFixture.get(c.fixture_id);
    if (!cur || c.edge > cur.edge || (c.edge === cur.edge && c.prob > cur.prob)) byFixture.set(c.fixture_id, c);
  }
  return [...byFixture.values()];
}

/**
 * Genera las 3 combinadas del día. Solo partidos distintos. Siempre devuelve probabilidad conjunta.
 * Estrategia: ordenar por probabilidad (asegura el umbral) y desempatar por ventaja.
 */
export function buildCombos(cands: ComboSelection[]): Record<ComboKind, Combo | null> {
  const pool = bestPerFixture(cands).sort((a, b) => b.prob - a.prob || b.edge - a.edge);
  const result = {} as Record<ComboKind, Combo | null>;
  for (const kind of Object.keys(COMBO_RULES) as ComboKind[]) {
    const { size, minJointProb } = COMBO_RULES[kind];
    if (pool.length < size) {
      result[kind] = null;
      continue;
    }
    const picked = pool.slice(0, size);
    const jointProb = picked.reduce((p, s) => p * s.prob, 1);
    const totalPrice = picked.reduce((p, s) => p * s.price, 1);
    result[kind] = jointProb >= minJointProb ? { kind, selections: picked, jointProb, totalPrice } : null;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// Combinadas de portada: la más probable del día y "la soñadora" (6 jugadas, pago alto).
// ---------------------------------------------------------------------------------------------------------

export interface DayCombo<T extends ComboSelection = ComboSelection> {
  selections: T[];
  jointProb: number;
  totalPrice: number;
}

/** Mercados que se entienden de un vistazo; mitades, jugadores y marcador exacto no entran en portada. */
const DAY_COMBO_MARKETS = new Set(['1x2', 'dc', 'totals', 'btts', 'team_totals', 'ah']);

export const PROBABLE_LEG_MIN_PROB = 0.6;
/** Por debajo de esta cuota una jugada casi no suma al pago. */
export const PROBABLE_LEG_MIN_PRICE = 1.2;
/** La tercera jugada solo entra si la combinada sigue saliendo al menos la mitad de las veces. */
export const PROBABLE_THIRD_LEG_MIN_JOINT = 0.5;
export const DREAM_LEGS = 6;
export const DREAM_LEG_MIN_PROB = 0.4;
export const DREAM_LEG_MIN_PRICE = 1.5;

function toDayCombo<T extends ComboSelection>(selections: T[]): DayCombo<T> {
  return { selections, jointProb: selections.reduce((p, s) => p * s.prob, 1), totalPrice: selections.reduce((p, s) => p * s.price, 1) };
}

function pickPerFixture<T extends ComboSelection>(cands: readonly T[], ok: (c: T) => boolean, better: (a: T, b: T) => boolean): T[] {
  const byFixture = new Map<number, T>();
  for (const c of cands) {
    if (!DAY_COMBO_MARKETS.has(c.market) || !(c.price > 1) || !ok(c)) continue;
    const cur = byFixture.get(c.fixture_id);
    if (!cur || better(c, cur)) byFixture.set(c.fixture_id, c);
  }
  return [...byFixture.values()];
}

/**
 * La combinada con mayor probabilidad del día: la jugada más probable de cada partido (≥ 60 %, cuota ≥ 1.20),
 * las dos mejores; entra una tercera solo si la probabilidad conjunta sigue en 50 % o más. null si no hay dos.
 */
export function mostProbableCombo<T extends ComboSelection>(cands: readonly T[]): DayCombo<T> | null {
  const pool = pickPerFixture(cands, (c) => c.prob >= PROBABLE_LEG_MIN_PROB && c.price >= PROBABLE_LEG_MIN_PRICE, (a, b) => a.prob > b.prob || (a.prob === b.prob && a.price > b.price)).sort((a, b) => b.prob - a.prob || b.price - a.price);
  if (pool.length < 2) return null;
  const two = toDayCombo(pool.slice(0, 2));
  if (pool.length >= 3) {
    const three = toDayCombo(pool.slice(0, 3));
    if (three.jointProb >= PROBABLE_THIRD_LEG_MIN_JOINT) return three;
  }
  return two;
}

/**
 * "La soñadora": 6 jugadas de 6 partidos distintos buscando el pago más alto sin caer en lo imposible. De cada
 * partido, la de mayor cuota entre las que el modelo ve al menos al 40 % (prefiere las que tienen ventaja sobre la
 * cuota); de todos los partidos, las 6 de mayor cuota. Siempre con su probabilidad conjunta a la vista. null si
 * no hay 6 partidos.
 */
export function dreamCombo<T extends ComboSelection>(cands: readonly T[], legs = DREAM_LEGS): DayCombo<T> | null {
  const value = (c: T) => Number(c.edge > 0);
  const pool = pickPerFixture(cands, (c) => c.prob >= DREAM_LEG_MIN_PROB && c.price >= DREAM_LEG_MIN_PRICE, (a, b) => value(a) > value(b) || (value(a) === value(b) && a.price > b.price)).sort((a, b) => value(b) - value(a) || b.price - a.price);
  if (pool.length < legs) return null;
  return toDayCombo(pool.slice(0, legs));
}
