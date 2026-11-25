import { getLocale, getTranslations } from 'next-intl/server';
import type { Odd } from '@/lib/db/types';
import { selectionLabel } from '@/lib/labels';
import type { Locale } from '@/i18n/config';

const SHOW: Array<{ market: string; selection: string; line: number | null }> = [
  { market: '1x2', selection: 'home', line: null },
  { market: '1x2', selection: 'draw', line: null },
  { market: '1x2', selection: 'away', line: null },
  { market: 'totals', selection: 'over', line: 2.5 },
  { market: 'totals', selection: 'under', line: 2.5 },
  { market: 'btts', selection: 'yes', line: null },
  { market: 'btts', selection: 'no', line: null },
];
const MAX_BOOKS = 5;

/**
 * Compara cuotas: para cada jugada principal, las casas ordenadas de la que mejor paga a la que peor.
 * Pensado para móvil (sin tabla con scroll lateral): la primera casa de cada fila es la mejor.
 */
export async function Comparador({ odds, home, away }: { odds: Odd[]; home: string; away: string }) {
  const t = await getTranslations('partido');
  const locale = (await getLocale()) as Locale;
  if (!odds.length) return null;
  const rows = SHOW.map((s) => {
    const byBook = new Map<string, number>();
    for (const o of odds) {
      if (o.market !== s.market || o.selection !== s.selection) continue;
      if (s.line === null ? o.line !== null : Number(o.line) !== s.line) continue;
      const price = Number(o.price);
      if (!Number.isFinite(price) || price <= 1) continue;
      byBook.set(o.bookmaker, Math.max(byBook.get(o.bookmaker) ?? 0, price));
    }
    const books = [...byBook.entries()].sort((a, b) => b[1] - a[1]);
    return { ...s, books: books.slice(0, MAX_BOOKS), total: books.length, worst: books.length ? books[books.length - 1][1] : null };
  }).filter((r) => r.books.length > 0);
  if (!rows.length) return null;
  const bookCount = new Set(odds.map((o) => o.bookmaker)).size;

  return (
    <section className="card overflow-hidden" aria-labelledby="comparador">
      <div className="p-4 pb-3">
        <h2 id="comparador" className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          {t('comparator')}
        </h2>
        <p className="mt-1 text-xs text-faint">{t('comparatorHint', { count: bookCount })}</p>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((r) => {
          const best = r.books[0][1];
          const gain = r.worst !== null && r.total > 1 ? best / r.worst - 1 : 0;
          return (
            <li key={`${r.market}${r.selection}${r.line}`} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{selectionLabel(r.market, r.selection, r.line, { home, away }, locale)}</p>
                {gain >= 0.02 && <p className="num shrink-0 text-xs text-muted">{t('comparatorGain', { pct: Math.round(gain * 100) })}</p>}
              </div>
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                {r.books.map(([book, price], i) => (
                  <div key={book} className={`min-w-[84px] shrink-0 rounded-md border px-2.5 py-1.5 ${i === 0 ? 'border-[var(--ventaja-dim)] bg-[var(--ventaja-bg)]' : 'border-border bg-bg'}`}>
                    <p className={`num text-base ${i === 0 ? 'font-semibold text-ventaja' : ''}`}>{price.toFixed(2)}</p>
                    <p className="max-w-[96px] truncate text-[11px] text-muted">{book}</p>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
