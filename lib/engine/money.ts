import type { Currency, PickResult } from '@/lib/db/types';

export const CURRENCIES: readonly Currency[] = ['USD', 'PEN'];
export const DEFAULT_STAKE = 10;
export const MAX_STAKE = 100000;

export function isCurrency(v: unknown): v is Currency {
  return v === 'USD' || v === 'PEN';
}

/** Formato de dinero en la moneda del usuario: "$12.50" o "S/ 12.50". El signo va delante si es negativo. */
export function fmtMoney(amount: number, currency: Currency, locale: 'es' | 'en' = 'es', signed = false): string {
  const tag = currency === 'PEN' ? 'es-PE' : locale === 'en' ? 'en-US' : 'es-US';
  const nf = new Intl.NumberFormat(tag, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const abs = nf.format(Math.abs(amount)).replace(/ /g, ' ');
  if (amount < 0) return `−${abs}`;
  return signed && amount > 0 ? `+${abs}` : abs;
}

/** Ganancia o pérdida en dinero: las unidades ya están calculadas para stake 1u, así que basta multiplicar. */
export function playMoney(units: number, stake: number | null): number {
  if (stake === null || !Number.isFinite(stake)) return 0;
  return Math.round(units * stake * 100) / 100;
}

/** Lo que se cobra si gana (stake incluido). */
export function payout(stake: number, price: number | null): number | null {
  if (price === null || !Number.isFinite(price) || price <= 0) return null;
  return Math.round(stake * price * 100) / 100;
}

export interface MoneyOutcome {
  result: PickResult | null;
  units: number;
  stake: number | null;
  settled_at: string | null;
}

export interface MoneySummary {
  /** Dinero total apostado en jugadas con resultado. */
  staked: number;
  /** Balance neto en dinero (ganancias menos pérdidas). */
  balance: number;
  /** Jugadas sin stake registrado (marcadas antes de la migración): no entran en el balance. */
  withoutStake: number;
}

export function summarizeMoney(plays: readonly MoneyOutcome[]): MoneySummary {
  let staked = 0;
  let balance = 0;
  let withoutStake = 0;
  for (const p of plays) {
    if (p.result === null) continue;
    if (p.stake === null) {
      withoutStake++;
      continue;
    }
    staked += Number(p.stake);
    balance += playMoney(Number(p.units), Number(p.stake));
  }
  return { staked: Math.round(staked * 100) / 100, balance: Math.round(balance * 100) / 100, withoutStake };
}

export interface Streaks {
  /** Racha actual: positiva si son victorias seguidas, negativa si son derrotas seguidas. */
  current: number;
  bestWin: number;
  worstLoss: number;
}

/** Rachas de aciertos/fallos, en orden cronológico de cierre. Las nulas no cortan la racha. */
export function streaks(plays: readonly MoneyOutcome[]): Streaks {
  const decided = plays
    .filter((p): p is MoneyOutcome & { result: 'acierto' | 'fallo' } => p.result === 'acierto' || p.result === 'fallo')
    .sort((a, b) => new Date(a.settled_at ?? 0).getTime() - new Date(b.settled_at ?? 0).getTime());
  let current = 0;
  let bestWin = 0;
  let worstLoss = 0;
  for (const p of decided) {
    if (p.result === 'acierto') current = current > 0 ? current + 1 : 1;
    else current = current < 0 ? current - 1 : -1;
    bestWin = Math.max(bestWin, current);
    worstLoss = Math.min(worstLoss, current);
  }
  return { current, bestWin, worstLoss: Math.abs(worstLoss) };
}

export interface MonthRecord {
  /** AAAA-MM */
  month: string;
  hits: number;
  misses: number;
  voids: number;
  units: number;
  balance: number;
}

/** Registro mes a mes (por fecha de cierre), del más reciente al más antiguo. */
export function monthlyRecord(plays: readonly MoneyOutcome[], timeZone = 'America/New_York'): MonthRecord[] {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' });
  const map = new Map<string, MonthRecord>();
  for (const p of plays) {
    if (p.result === null || !p.settled_at) continue;
    const month = fmt.format(new Date(p.settled_at)).slice(0, 7);
    const r = map.get(month) ?? { month, hits: 0, misses: 0, voids: 0, units: 0, balance: 0 };
    if (p.result === 'acierto') r.hits++;
    else if (p.result === 'fallo') r.misses++;
    else r.voids++;
    r.units = Math.round((r.units + Number(p.units)) * 100) / 100;
    r.balance = Math.round((r.balance + playMoney(Number(p.units), p.stake === null ? null : Number(p.stake))) * 100) / 100;
    map.set(month, r);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}
