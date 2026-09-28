import type { Prediction, Sello } from '@/lib/db/types';
import { qualifiesAsPick } from './edge';

/** Por debajo de esta probabilidad una jugada se considera arriesgada y no entra en "Mejores jugadas". */
export const SAFE_MIN_PROB = 0.6;
/** A partir de esta probabilidad el riesgo se muestra como bajo. */
export const LOW_RISK_PROB = 0.7;
export const MAX_BEST_PLAYS = 5;

const EXCLUDED_MARKETS = new Set(['correct_score']);

export type RiskLevel = 'bajo' | 'medio' | 'alto';

export interface PlayCandidate {
  id: number;
  market: string;
  selection: string;
  line: number | null;
  player_id: number | null;
  prob: number;
  best_price: number | null;
  edge: number | null;
  sello: Sello;
}

/** Predicción guardada → candidata con números (la base de datos puede devolver numeric como texto). */
export function toPlayCandidate(p: Prediction): PlayCandidate & { player_name: string | null } {
  return {
    id: p.id,
    market: p.market,
    selection: p.selection,
    line: p.line === null ? null : Number(p.line),
    player_id: p.player_id,
    player_name: p.player_name,
    prob: Number(p.prob),
    best_price: p.best_price === null ? null : Number(p.best_price),
    edge: p.edge === null ? null : Number(p.edge),
    sello: p.sello,
  };
}

export function riskLevel(prob: number): RiskLevel {
  if (prob >= LOW_RISK_PROB) return 'bajo';
  if (prob >= SAFE_MIN_PROB) return 'medio';
  return 'alto';
}

function isSafePlay(c: PlayCandidate): boolean {
  if (EXCLUDED_MARKETS.has(c.market)) return false;
  if (!c.best_price) return false;
  if (c.prob < SAFE_MIN_PROB) return false;
  return qualifiesAsPick({ prob: c.prob, edge: c.edge });
}

/** Los jugadores son mercados independientes entre sí; el resto se agrupa por mercado. */
function groupKey(c: PlayCandidate): string {
  return c.player_id === null ? c.market : `${c.market}:${c.player_id}`;
}

/**
 * Mejores jugadas de un partido: con ventaja, con cuota y sin riesgo alto.
 * Una por mercado (la más probable), para no mostrar líneas que dicen lo mismo. Función pura.
 */
export function bestPlays<T extends PlayCandidate>(candidates: readonly T[], max = MAX_BEST_PLAYS): T[] {
  const byGroup = new Map<string, T>();
  for (const c of candidates) {
    if (!isSafePlay(c)) continue;
    const key = groupKey(c);
    const current = byGroup.get(key);
    if (!current || c.prob > current.prob || (c.prob === current.prob && (c.edge ?? 0) > (current.edge ?? 0))) byGroup.set(key, c);
  }
  return [...byGroup.values()].sort((a, b) => b.prob - a.prob || (b.edge ?? 0) - (a.edge ?? 0)).slice(0, max);
}
