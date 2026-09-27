import Link from 'next/link';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Sello } from '@/components/ui/Sello';
import { PerformanceChart } from '@/components/historial/PerformanceChart';
import { getHistorial } from '@/lib/data/queries';
import { getTimeZone } from '@/lib/tz';
import { marketName, selectionLabel } from '@/lib/labels';
import { fmtDate, fmtUnits, odds, pct, signedPct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('historial');
  return { title: t('title'), description: t('subtitle') };
}

/** Pantalla pública: es el argumento de venta. */
export default async function HistorialPage() {
  const [t, locale, data] = await Promise.all([getTranslations('historial'), getLocale() as Promise<Locale>, getHistorial()]);
  const timeZone = getTimeZone();
  const kpis = [
    { label: t('hitRate'), value: pct(data.hitRate), accent: true },
    { label: t('roi'), value: data.roi === null ? '—' : signedPct(data.roi), hint: t('roiHint') },
    { label: t('streak'), value: data.streak.kind ? (data.streak.kind === 'acierto' ? t('streakHits', { count: data.streak.count }) : t('streakMisses', { count: data.streak.count })) : '—' },
    { label: t('closedPicks'), value: String(data.total) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-muted">{k.label}</p>
            <p className={`num mt-1 text-2xl ${k.accent ? 'text-ventaja' : ''}`}>{k.value}</p>
            {k.hint && <p className="text-xs text-faint">{k.hint}</p>}
          </div>
        ))}
      </div>

      {data.total === 0 ? (
        <div className="card p-8 text-center text-muted">
          {t('empty')}
          {data.pending > 0 && <p className="mt-2 text-sm text-faint">{t('pending', { count: data.pending })}</p>}
        </div>
      ) : (
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
                    <th>{locale === 'es' ? 'Fecha' : 'Date'}</th>
                    <th>{locale === 'es' ? 'Partido' : 'Match'}</th>
                    <th>{locale === 'es' ? 'Mercado' : 'Market'}</th>
                    <th className="text-right">{locale === 'es' ? 'Cuota' : 'Odds'}</th>
                    <th>{locale === 'es' ? 'Sello' : 'Seal'}</th>
                    <th className="text-right">{locale === 'es' ? 'Resultado' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.picks.map((p) => {
                    const f = p.fixture;
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
                        <td className={`num text-right font-semibold ${p.result === 'acierto' ? 'text-acierto' : p.result === 'fallo' ? 'text-fallo' : 'text-nulo'}`}>
                          {p.result === 'acierto' ? '✓' : p.result === 'fallo' ? '✗' : '–'} {fmtUnits(Number(p.units))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
