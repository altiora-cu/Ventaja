/** Estados de partido de API-Football (compartido entre servidor y cliente). */
export const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
export const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
export const POSTPONED_STATUSES = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO', 'SUSP']);

export function isFinished(status: string): boolean {
  return FINISHED_STATUSES.has(status);
}
export function isLive(status: string): boolean {
  return LIVE_STATUSES.has(status);
}
