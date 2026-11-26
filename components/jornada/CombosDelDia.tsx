import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { SaveComboButton } from '@/components/jugadas/SaveComboButton';
import { IconLock } from '@/components/ui/Icons';
import type { DayComboLeg } from '@/lib/data/queries';
import type { Currency } from '@/lib/db/types';
import { dreamCombo, mostProbableCombo, type ComboSelection, type DayCombo } from '@/lib/engine/combos';
import { fmtMoney, payout } from '@/lib/engine/money';
import { selectionLabel } from '@/lib/labels';
import { cn, fmtTime, odds, pct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';
import type { LockMode } from './FixtureCard';

type Leg = ComboSelection & { id: number; home: string; away: string; kickoff: string; sameDay: boolean };

function toLeg(p: DayComboLeg): Leg {
  return {
    id: p.id,
    fixture_id: p.fixture_id,
    market: p.market,
    selection: p.selection,
    line: p.line === null ? null : Number(p.line),
    player_name: p.player_name,
    prob: Number(p.prob),
    price: Number(p.best_price),
    edge: p.edge === null ? 0 : Number(p.edge),
    sello: p.sello,
    home: p.fixture.home.name,
    away: p.fixture.away.name,
    kickoff: p.fixture.kickoff,
    sameDay: p.sameDay,
  };
}

interface Props {
  pool: DayComboLeg[];
  lock: LockMode;
  timeZone: string;
  currency: Currency;
  stake: number;
}

/**
 * Portada: la combinada más probable del día y "la soñadora" (6 jugadas, pago alto). Las dos muestran su
 * probabilidad conjunta: la primera sale a menudo y paga poco; la segunda paga mucho y sale pocas veces.
 */
export async function CombosDelDia({ pool, lock, timeZone, currency, stake }: Props) {
  const [t, tp, locale] = await Promise.all([getTranslations('jornada'), getTranslations('picks'), getLocale() as Promise<Locale>]);

  if (lock !== 'none') {
    return (
      <Link href={lock === 'login' ? '/registro' : '/activar'} className="card card-interactive flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('combosTitle')}</p>
          <p className="mt-1 text-sm text-muted">{lock === 'login' ? t('combosLockedLogin') : t('combosLocked')}</p>
        </div>
        <IconLock width={20} height={20} className="shrink-0 text-muted" />
      </Link>
    );
  }

  const legs = pool.map(toLeg);
  const probable = mostProbableCombo(legs.filter((l) => l.sameDay)) ?? null;
  const dream = dreamCombo(legs.filter((l) => l.sameDay)) ?? dreamCombo(legs);
  if (!probable && !dream) return null;

  const card = (combo: DayCombo<Leg>, kind: 'probable' | 'dream') => {
    const win = payout(stake, combo.totalPrice);
    const mixed = combo.selections.some((l) => !l.sameDay);
    return (
      <article key={kind} className={cn('card flex flex-col p-4', kind === 'probable' && 'border-[var(--ventaja-dim)]')}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className={cn('text-xs font-semibold uppercase tracking-[0.06em]', kind === 'probable' ? 'text-ventaja' : 'text-[var(--warning)]')}>{t(kind === 'probable' ? 'comboProbable' : 'comboDream')}</h3>
            <p className="mt-1 text-xs text-muted">{t(kind === 'probable' ? 'comboProbableHint' : 'comboDreamHint', { count: combo.selections.length })}</p>
          </div>
          <span className="num shrink-0 text-right">
            <span className="block text-2xl font-semibold">{odds(combo.totalPrice)}</span>
            <span className="block text-[11px] text-faint">{tp('totalOdds')}</span>
          </span>
        </header>

        <ul className="mt-3 flex-1 space-y-1.5">
          {combo.selections.map((l) => (
            <li key={l.id}>
              <Link href={`/partido/${l.fixture_id}`} className="flex items-center justify-between gap-3 rounded-sm border border-border bg-bg px-3 py-2 hover:bg-hover">
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted">
                    {l.home} vs {l.away} · <span className="num">{l.sameDay ? fmtTime(l.kickoff, locale, timeZone) : `${t('tomorrow').toLowerCase()} ${fmtTime(l.kickoff, locale, timeZone)}`}</span>
                  </span>
                  <span className="block truncate text-sm font-medium">{selectionLabel(l.market, l.selection, l.line, { home: l.home, away: l.away, player: l.player_name }, locale)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-sm">{odds(l.price)}</span>
                  <span className="num block text-[11px] text-faint">{pct(l.prob)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-3 space-y-3 border-t border-border pt-3">
          <dl className="flex items-end justify-between gap-3 text-sm">
            <div>
              <dt className="text-xs text-faint">{tp('jointProb')}</dt>
              <dd className={cn('num text-lg', kind === 'probable' ? 'text-ventaja' : '')}>{pct(combo.jointProb, combo.jointProb < 0.1 ? 1 : 0)}</dd>
            </div>
            {win !== null && (
              <div className="text-right">
                <dt className="text-xs text-faint">{t('comboPayout', { stake: fmtMoney(stake, currency, locale) })}</dt>
                <dd className="num text-lg font-semibold">{fmtMoney(win, currency, locale)}</dd>
              </div>
            )}
          </dl>
          {kind === 'dream' && <p className="text-xs text-[var(--warning)]">{t('comboDreamRisk', { times: Math.max(1, Math.round(1 / combo.jointProb)) })}</p>}
          {mixed && <p className="text-xs text-faint">{t('comboMixed')}</p>}
          <SaveComboButton predictionIds={combo.selections.map((l) => l.id)} primary={kind === 'probable'} />
        </footer>
      </article>
    );
  };

  return (
    <section aria-labelledby="combos-del-dia" className="space-y-3">
      <h2 id="combos-del-dia" className="text-sm font-medium text-muted">
        {t('combosTitle')}
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {probable && card(probable, 'probable')}
        {dream && card(dream, 'dream')}
      </div>
    </section>
  );
}
