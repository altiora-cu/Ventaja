import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Sello } from '@/components/ui/Sello';
import { TeamLogo } from '@/components/ui/TeamLogo';
import { FormaChips } from '@/components/ui/FormaChips';
import { IconLock } from '@/components/ui/Icons';
import { StaggerItem } from '@/components/ui/Motion';
import type { FixtureWithAnalysis } from '@/lib/data/queries';
import { isFinished, isLive } from '@/lib/data/statuses';
import { selectionLabel } from '@/lib/labels';
import { fmtTime, odds, pct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export type LockMode = 'none' | 'login' | 'activar';

function MiniBars({ probs, locked }: { probs: { home: number; draw: number; away: number } | null; locked: boolean }) {
  const items: Array<[string, number]> = probs ? [['1', probs.home], ['X', probs.draw], ['2', probs.away]] : [['1', 0.33], ['X', 0.33], ['2', 0.34]];
  const max = Math.max(...items.map((i) => i[1]));
  return (
    <div className={`grid grid-cols-3 gap-2 ${locked ? 'locked' : ''}`} aria-hidden={locked}>
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-faint">{k}</span>
            <span className={`num ${v === max && probs ? 'text-ventaja' : 'text-muted'}`}>{pct(v)}</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-hover">
            <div className={`h-full rounded-full ${v === max && probs ? 'bg-ventaja' : 'bg-[var(--text-faint)]'}`} style={{ width: `${v * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export async function FixtureCard({ fixture: f, lock, timeZone }: { fixture: FixtureWithAnalysis; lock: LockMode; timeZone: string }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('jornada');
  const locked = lock !== 'none';
  const href = locked ? (lock === 'login' ? '/login?next=' + encodeURIComponent(`/partido/${f.id}`) : '/activar') : `/partido/${f.id}`;
  const top = f.analysis?.top_market ?? null;
  const review = f.analysis?.ai_review ?? null;
  const selloFinal = review?.sello_final ?? top?.sello ?? null;
  const finished = isFinished(f.status);
  const live = isLive(f.status);

  return (
    <StaggerItem>
      <Link href={href} className="card card-interactive block p-4" aria-label={`${f.home.name} vs ${f.away.name}`}>
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="num">
            {finished ? t('finished') : live ? <span className="text-ventaja">{t('live')}</span> : fmtTime(f.kickoff, locale, timeZone)}
          </span>
          {top && selloFinal && !locked && (
            <span className="inline-flex items-center gap-2">
              {top.small_sample && <span className="text-[11px] text-faint">{t('smallSample')}</span>}
              {review && review.verdict !== 'concuerda' && <span className="text-[11px] text-[var(--warning)]">{t(review.verdict === 'cautela' ? 'aiCaution' : 'aiDisagree')}</span>}
              <Sello nivel={selloFinal} animate={false} />
            </span>
          )}
          {locked && (
            <span className="inline-flex items-center gap-1 text-faint">
              <IconLock width={14} height={14} />
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {[
            { team: f.home, goals: f.home_goals, form: f.homeForm },
            { team: f.away, goals: f.away_goals, form: f.awayForm },
          ].map(({ team, goals, form }) => (
            <div key={team.id} className="flex items-center gap-3">
              <TeamLogo src={team.logo} name={team.name} size={32} />
              <span className="min-w-0 flex-1 truncate text-lg font-medium">{team.name}</span>
              {finished || live ? <span className="num text-lg">{goals ?? '–'}</span> : <FormaChips form={form} className="hidden sm:inline-flex" />}
            </div>
          ))}
        </div>

        {!finished && (
          <div className="mt-4">
            <MiniBars probs={f.probs} locked={locked} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          {finished && f.pick ? (
            <>
              <span className="min-w-0 truncate text-muted">{selectionLabel(f.pick.market, f.pick.selection, f.pick.line, { home: f.home.name, away: f.away.name, player: f.pick.player_name }, locale)}</span>
              <span className={`num shrink-0 ${f.pick.result === 'acierto' ? 'text-acierto' : f.pick.result === 'fallo' ? 'text-fallo' : 'text-nulo'}`}>{f.pick.result === 'acierto' ? '✓' : f.pick.result === 'fallo' ? '✗' : '–'}</span>
            </>
          ) : top ? (
            <>
              <span className={`min-w-0 truncate ${locked ? 'locked text-muted' : 'text-text'}`}>{t('bestMarket')}: {selectionLabel(top.market, top.selection, top.line, { home: f.home.name, away: f.away.name, player: top.player_name }, locale)}</span>
              <span className={`num shrink-0 ${locked ? 'locked' : 'text-muted'}`}>{odds(top.best_price)}</span>
            </>
          ) : (
            <span className="text-faint">{locked ? t('lockedHint') : '—'}</span>
          )}
        </div>
      </Link>
    </StaggerItem>
  );
}
