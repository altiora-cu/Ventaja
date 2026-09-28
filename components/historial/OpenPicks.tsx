import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Sello } from '@/components/ui/Sello';
import type { OpenSystemPick } from '@/lib/data/jugadas';
import { selectionLabel } from '@/lib/labels';
import { fmtDate, fmtTime, odds, pct, signedPct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface Props {
  picks: OpenSystemPick[];
  /** Picks en juego según el contador público; se usa cuando el visitante no tiene acceso. */
  pendingCount: number;
  canSee: boolean;
  unlockHref: string;
  locale: Locale;
  timeZone: string;
}

/** Picks publicados cuyo partido todavía no se juega. El detalle es contenido de pago. */
export async function OpenPicks({ picks, pendingCount, canSee, unlockHref, locale, timeZone }: Props) {
  const [t, tc] = await Promise.all([getTranslations('historial'), getTranslations('common')]);

  if (!canSee) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <p className="mx-auto max-w-lectura text-muted">{t('lockedOpen', { count: pendingCount })}</p>
        <Link href={unlockHref} className="btn btn-primary btn-sm">
          {tc('unlock')}
        </Link>
      </div>
    );
  }

  if (picks.length === 0) return <p className="card p-8 text-center text-muted">{t('openEmpty')}</p>;

  return (
    <section className="space-y-3">
      <p className="max-w-lectura text-sm text-muted">{t('openHint')}</p>
      <ul className="grid gap-2 lg:grid-cols-2">
        {picks.map((p) => {
          const f = p.fixture;
          return (
            <li key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/partido/${f.id}?vista=mejores`} className="text-xs text-muted hover:text-text">
                    {f.home.name} vs {f.away.name} · {f.league.name}
                  </Link>
                  <p className="mt-1 font-medium leading-snug">{selectionLabel(p.market, p.selection, p.line === null ? null : Number(p.line), { home: f.home.name, away: f.away.name, player: p.player_name }, locale)}</p>
                </div>
                <Sello nivel={p.sello} animate={false} />
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-faint">{t('kickoff')}</dt>
                  <dd className="num">
                    {fmtDate(f.kickoff, locale, { day: 'numeric', month: 'short' }, timeZone)} · {fmtTime(f.kickoff, locale, timeZone)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">{tc('probability')}</dt>
                  <dd className="num">{pct(Number(p.prob))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">{tc('bestOdds')}</dt>
                  <dd className="num">{odds(p.best_price === null ? null : Number(p.best_price))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">{tc('edge')}</dt>
                  <dd className="num text-ventaja">{signedPct(p.edge === null ? null : Number(p.edge))}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
