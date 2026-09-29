import type { PickResult } from '@/lib/db/types';

export interface PlayOutcome {
  /** null mientras la jugada siga abierta. */
  result: PickResult | null;
  units: number;
}

export interface PlaySummary {
  total: number;
  pending: number;
  /** Jugadas con acierto o fallo (las nulas no cuentan para el porcentaje). */
  decided: number;
  hits: number;
  misses: number;
  voids: number;
  hitRate: number | null;
  units: number;
  roi: number | null;
}

/** Resumen de rendimiento de una lista de jugadas o combinadas. Función pura con tests. */
export function summarizePlays(plays: readonly PlayOutcome[]): PlaySummary {
  const hits = plays.filter((p) => p.result === 'acierto').length;
  const misses = plays.filter((p) => p.result === 'fallo').length;
  const voids = plays.filter((p) => p.result === 'nulo').length;
  const pending = plays.filter((p) => p.result === null).length;
  const decided = hits + misses;
  const rawUnits = plays.reduce((acc, p) => (p.result === null ? acc : acc + Number(p.units)), 0);
  const units = Math.round(rawUnits * 100) / 100;
  return {
    total: plays.length,
    pending,
    decided,
    hits,
    misses,
    voids,
    hitRate: decided ? hits / decided : null,
    units,
    roi: decided ? units / decided : null,
  };
}
