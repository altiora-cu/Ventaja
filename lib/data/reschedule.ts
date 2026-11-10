/**
 * Emparejado de partidos reprogramados. The Odds API asigna un id de evento nuevo cuando un partido
 * cambia de fecha y deja de devolver el viejo; sin esto, la app creaba un segundo partido y el
 * primero quedaba para siempre con la fecha antigua y sin marcador.
 */

export interface ExistingFixture {
  id: number;
  external_id: string | null;
  kickoff: string;
  home_id: number;
  away_id: number;
}

export const RESCHEDULE_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * Busca, entre los partidos ya guardados de la liga, el mismo cruce (local y visitante) a ≤ 7 días del
 * nuevo pitazo cuyo id de evento el proveedor ya no devuelve. Si hay varios, el de fecha más cercana.
 * `providerIds` son los ids que el proveedor devolvió en esta corrida: un partido que sigue vivo con su
 * propio id no se reutiliza. `used` evita asignar el mismo partido a dos filas de la misma corrida.
 */
export function findRescheduled(row: { home_id: number; away_id: number; kickoff: string }, existing: readonly ExistingFixture[], providerIds: ReadonlySet<string>, used: ReadonlySet<number>): ExistingFixture | null {
  const target = new Date(row.kickoff).getTime();
  let best: ExistingFixture | null = null;
  let bestDelta = Infinity;
  for (const f of existing) {
    if (f.home_id !== row.home_id || f.away_id !== row.away_id) continue;
    if (used.has(f.id)) continue;
    if (f.external_id !== null && providerIds.has(f.external_id)) continue;
    const delta = Math.abs(new Date(f.kickoff).getTime() - target);
    if (delta > RESCHEDULE_WINDOW_DAYS * DAY_MS) continue;
    if (delta < bestDelta) {
      best = f;
      bestDelta = delta;
    }
  }
  return best;
}
