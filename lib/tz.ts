import { cookies } from 'next/headers';

export const TZ_COOKIE = 'tz';
export const DEFAULT_TZ = 'America/New_York';

export function isValidTimeZone(tz: string | undefined): tz is string {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Zona horaria del usuario (cookie puesta por el cliente) o ET por defecto. Solo servidor. */
export function getTimeZone(): string {
  const tz = cookies().get(TZ_COOKIE)?.value;
  return isValidTimeZone(tz) ? tz : DEFAULT_TZ;
}

/** Offset (minutos) de una zona en un instante dado. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Inicio del día AAAA-MM-DD en la zona indicada, como instante UTC. */
export function zonedStartOfDay(dateKey: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const off1 = tzOffsetMinutes(new Date(guess), timeZone);
  let start = guess - off1 * 60_000;
  const off2 = tzOffsetMinutes(new Date(start), timeZone);
  if (off2 !== off1) start = guess - off2 * 60_000;
  return new Date(start);
}
