import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PerformanceChart } from '@/components/historial/PerformanceChart';
import { Sello } from '@/components/ui/Sello';
import type { HistorialData } from '@/lib/data/queries';
import { marketName, selectionLabel } from '@/lib/labels';
import { fmtDate, fmtUnits, odds, pct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

const RESULT_STYLE = { acierto: { mark: '✓', className: 'text-acierto' }, fallo: { mark: '✗', className: 'text-fallo' }, nulo: { mark: '–', className: 'text-nulo' } } as const;

/** Picks ya cerrados: gráfica, acierto por mercado y tabla con el resultado de cada uno. */
export async function ClosedPicks({ data, locale, timeZone }: { data: HistorialData; locale: Locale; timeZone: string }) {
  const [t, tc, ts] = await Promise.all([getTranslations('historial'), getTranslations('common'), getTranslations('sello')]);

  if (data.total === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        {t('empty')}
        {data.pending > 0 && <p className="mt-2 text-sm text-faint">{t('pending', { count: data.pending })}</p>}
      </div>
    );
  }

  return (
    <>
      <PerformanceChart series={data.series} />

      {data.byMarket.length > 0 && (
        <section className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('byMarket')}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.byMarket.map((m) => (
              <li key={m.market} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{marketName(m.market, locale)}</span>
                <span className="num">
                  {pct(m.hitRate)} <span className="text-faint">({m.n})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('closedPicks')}</p>
          <p className="text-xs text-faint">{t('showing', { count: data.picks.length })}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th>{tc('date')}</th>
                <th>{tc('match')}</th>
                <th>{tc('market')}</th>
                <th className="text-right">{tc('odds')}</th>
                <th>{ts('label')}</th>
                <th className="text-right">{tc('result')}</th>
              </tr>
            </thead>
            <tbody>
              {data.picks.map((p) => {
                const f = p.fixture;
                const style = RESULT_STYLE[p.result];
                return (
                  <tr key={p.id}>
                    <td className="num whitespace-nowrap text-muted">{fmtDate(f?.kickoff ?? p.settled_at, locale, { day: '2-digit', month: '2-digit' }, timeZone)}</td>
                    <td>
                      {f ? (
                        <Link href={`/partido/${f.id}`} className="hover:text-ventaja">
                          {f.home.name} {f.home_goals}–{f.away_goals} {f.away.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-muted">{f ? selectionLabel(p.market, p.selection, p.line, { home: f.home.name, away: f.away.name, player: p.player_name }, locale) : p.market}</td>
                    <td className="num text-right">{odds(p.price === null ? null : Number(p.price))}</td>
                    <td>
                      <Sello nivel={p.sello} animate={false} />
                    </td>
                    <td className={`num text-right font-semibold ${style.className}`}>
                      {style.mark} {fmtUnits(Number(p.units))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
