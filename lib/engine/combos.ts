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
