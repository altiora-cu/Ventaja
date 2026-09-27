import type { Locale } from '@/i18n/config';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function pct(p: number | null | undefined, digits = 0): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  return `${(p * 100).toFixed(digits)}%`;
}

export function signedPct(p: number | null | undefined, digits = 1): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  const v = p * 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export function odds(price: number | null | undefined): string {
  if (!price) return '—';
  return price.toFixed(2);
}

export function fmtLine(line: number | null | undefined): string {
  if (line === null || line === undefined) return '';
  if (line > 0) return `+${line}`;
  return `${line}`;
}

export function fmtUnits(u: number): string {
  const s = u.toFixed(2);
  return u > 0 ? `+${s}` : s;
}

export function toDateKey(d: Date, timeZone = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function fmtTime(iso: string, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

export function fmtDate(iso: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { ...opts, timeZone }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function fmtDateShort(iso: string | Date, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(
    typeof iso === 'string' ? new Date(iso) : iso,
  );
}

export function whatsappLink(email?: string | null, message?: string): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP ?? '13054574987';
  const text =
    message ??
    `Hola Frank, quiero activar mi cuenta de Ventaja. Mi correo es: ${email ?? ''}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function appUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function shortTeam(name: string, max = 14): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trimEnd() + '…';
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
