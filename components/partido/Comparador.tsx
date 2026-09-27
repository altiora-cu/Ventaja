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

/** Tabla: casas en columnas, mejor cuota resaltada en --ventaja. */
export async function Comparador({ odds, home, away }: { odds: Odd[]; home: string; away: string }) {
  const t = await getTranslations('partido');
  const locale = (await getLocale()) as Locale;
  if (!odds.length) return null;
  const books = [...new Set(odds.map((o) => o.bookmaker))].sort();
  const rows = SHOW.map((s) => {
    const cells = books.map((b) => odds.find((o) => o.bookmaker === b && o.market === s.market && o.selection === s.selection && (s.line === null ? o.line === null : Number(o.line) === s.line))?.price ?? null);
    const best = Math.max(...cells.map((c) => (c === null ? 0 : Number(c))));
    return { ...s, cells, best };
  }).filter((r) => r.cells.some((c) => c !== null));
  if (!rows.length) return null;
  return (
    <section className="card overflow-hidden">
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('comparator')}</p>
        <p className="mt-1 text-xs text-faint">{t('comparatorHint')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="table min-w-[520px]">
          <thead>
            <tr>
              <th>{''}</th>
              {books.map((b) => (
                <th key={b} className="text-right">
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.market}${r.selection}${r.line}`}>
                <td className="text-muted">{selectionLabel(r.market, r.selection, r.line, { home, away }, locale)}</td>
                {r.cells.map((c, i) => (
                  <td key={books[i]} className={`num text-right ${c !== null && Number(c) === r.best ? 'text-ventaja font-semibold' : ''}`}>
                    {c === null ? '—' : Number(c).toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
