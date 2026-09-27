import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Sello } from '@/components/ui/Sello';
import { TeamLogo } from '@/components/ui/TeamLogo';
import { FadeIn } from '@/components/ui/Motion';
import { IconLock } from '@/components/ui/Icons';
import type { FixtureWithAnalysis } from '@/lib/data/queries';
import { selectionLabel } from '@/lib/labels';
import { fmtTime, odds, pct, signedPct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';
import type { LockMode } from './FixtureCard';

export function choosePickOfDay(fixtures: FixtureWithAnalysis[]): FixtureWithAnalysis | null {
  const candidates = fixtures.filter((f) => f.analysis?.top_market?.sello === 'alta' && f.status === 'NS');
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (b.analysis!.top_market!.edge ?? 0) - (a.analysis!.top_market!.edge ?? 0))[0];
}

/** Tarjeta destacada con borde --ventaja: el único acento verde fuerte de la pantalla. */
export async function PickDelDia({ fixture: f, lock, timeZone }: { fixture: FixtureWithAnalysis | null; lock: LockMode; timeZone: string }) {
  const t = await getTranslations('jornada');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) as Locale;
  if (!f) {
    return (
      <section className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('pickOfDay')}</p>
        <p className="mt-2 text-muted">{t('noPickOfDay')}</p>
      </section>
    );
  }
  const top = f.analysis!.top_market!;
  const locked = lock !== 'none';
  const href = locked ? (lock === 'login' ? '/login' : '/activar') : `/partido/${f.id}`;
  return (
    <FadeIn>
      <Link href={href} className="card card-interactive block border-[var(--ventaja)] p-4 sm:p-5" style={{ borderColor: 'var(--ventaja)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ventaja">{t('pickOfDay')}</p>
          <span className="num text-xs text-muted">
            {f.league.name} · {fmtTime(f.kickoff, locale, timeZone)}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <TeamLogo src={f.home.logo} name={f.home.name} size={44} className="rounded-full bg-elevated" />
              <TeamLogo src={f.away.logo} name={f.away.name} size={44} className="rounded-full bg-elevated" />
            </div>
            <div>
              <p className="text-lg font-medium leading-tight">
                {f.home.name} <span className="text-faint">vs</span> {f.away.name}
              </p>
              <p className={`mt-1 text-sm text-muted ${locked ? 'locked' : ''}`}>{selectionLabel(top.market, top.selection, top.line, { home: f.home.name, away: f.away.name, player: top.player_name }, locale)}</p>
            </div>
          </div>
          <div className={`flex items-center gap-6 ${locked ? 'locked' : ''}`}>
            <div>
              <p className="text-xs text-faint">{tc('probability')}</p>
              <p className="num text-2xl">{pct(top.prob)}</p>
            </div>
            <div>
              <p className="text-xs text-faint">{tc('bestOdds')}</p>
              <p className="num text-2xl">{odds(top.best_price)}</p>
            </div>
            <div>
              <p className="text-xs text-faint">{tc('edge')}</p>
              <p className="num text-2xl text-ventaja">{signedPct(top.edge)}</p>
            </div>
            <Sello nivel={top.sello} animate={false} />
          </div>
        </div>
        {locked && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted">
            <IconLock width={14} height={14} /> {lock === 'login' ? t('loginHint') : t('lockedHint')}
          </p>
        )}
      </Link>
    </FadeIn>
  );
}
