import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Sello } from '@/components/ui/Sello';
import { TeamLogo } from '@/components/ui/TeamLogo';
import { FadeIn } from '@/components/ui/Motion';
import { MercadosList } from '@/components/partido/MercadosList';
import { MejoresJugadas } from '@/components/partido/MejoresJugadas';
import { Marcador } from '@/components/partido/Marcador';
import { FormaBlock } from '@/components/partido/FormaBlock';
import { Comparador } from '@/components/partido/Comparador';
import { TeamHistory } from '@/components/partido/TeamHistory';
import { ShareButton } from '@/components/partido/ShareButton';
import { RevisionIA } from '@/components/partido/RevisionIA';
import { AnalisisWeb } from '@/components/partido/AnalisisWeb';
import { getViewer } from '@/lib/auth/viewer';
import { getMarkedPredictionIds } from '@/lib/data/jugadas';
import { getFixtureDetail } from '@/lib/data/queries';
import { isFinished } from '@/lib/data/statuses';
import { marketName } from '@/lib/labels';
import { getTimeZone } from '@/lib/tz';
import { fmtDate, fmtTime } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

/** Mercados que dependen de estadísticas que las fuentes actuales no entregan. */
const STAT_MARKETS = ['corners', 'cards', 'sot', 'player_sot', 'scorer'] as const;
const OPEN_STATUSES = ['NS', 'TBD'];

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const detail = await getFixtureDetail(Number(params.id));
  if (!detail) return {};
  const { fixture: f } = detail;
  const title = `${f.home.name} vs ${f.away.name}`;
  return { title, description: detail.analysis?.lectura ?? undefined, openGraph: { title, images: [`/api/og/pick/${f.id}`] } };
}

export default async function PartidoPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const [detail, t, locale, viewer] = await Promise.all([getFixtureDetail(id), getTranslations('partido'), getLocale() as Promise<Locale>, getViewer()]);
  if (!detail) notFound();
  const timeZone = getTimeZone();
  const { fixture: f, analysis, predictions, odds, injuries, homeStats, awayStats, referee, teamHistory } = detail;
  const lectura = (locale === 'en' ? analysis?.lectura_en : analysis?.lectura) ?? analysis?.lectura ?? null;
  const top = analysis?.top_market ?? null;
  const review = analysis?.ai_review ?? null;
  const selloMostrado = review?.sello_final ?? top?.sello ?? null;
  const finished = isFinished(f.status);
  const missing = (teamId: number) => injuries.filter((i) => i.team_id === teamId);
  const locked = !OPEN_STATUSES.includes(f.status) || new Date(f.kickoff).getTime() <= Date.now();
  const markedIds = await getMarkedPredictionIds(viewer.user?.id ?? null, predictions);
  const aiPlays = review?.plays ?? null;
  const missingMarkets = predictions.length ? STAT_MARKETS.filter((m) => !predictions.some((p) => p.market === m)) : [];

  return (
    <article className="space-y-4">
      <header className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {f.league.name}
            {f.round ? ` · ${f.round}` : ''}
          </span>
          <span className="num">
            {fmtDate(f.kickoff, locale, { weekday: 'short', day: 'numeric', month: 'short' }, timeZone)} · {fmtTime(f.kickoff, locale, timeZone)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[f.home, f.away].map((team) => (
            <div key={team.id} className="flex flex-col items-center gap-2 text-center">
              <TeamLogo src={team.logo} name={team.name} size={64} />
              <span className="text-lg font-medium leading-tight">{team.name}</span>
              {missing(team.id).length > 0 && (
                <span className="text-xs text-muted">
                  {t('injuries')}: {missing(team.id).length}
                </span>
              )}
            </div>
          ))}
          <div className="col-start-2 row-start-1 text-center">
            {finished ? (
              <span className="num text-2xl">
                {f.home_goals}–{f.away_goals}
              </span>
            ) : (
              <span className="text-faint">vs</span>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-faint">
          {f.venue && (
            <span>
              {t('stadium')}: {f.venue}
              {f.city ? `, ${f.city}` : ''}
            </span>
          )}
          {f.referee && (
            <span>
              {t('referee')}: {f.referee.split(',')[0]}
              {referee?.cards_avg != null && <span className="num"> · {t('refereeCards', { avg: Number(referee.cards_avg).toFixed(1) })}</span>}
            </span>
          )}
        </div>
        {top && selloMostrado && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <Sello nivel={selloMostrado} />
            <ShareButton fixtureId={f.id} title={`${f.home.name} vs ${f.away.name}`} />
          </div>
        )}
      </header>

      {/* 1. Qué jugar: las mejores jugadas y todos los mercados con su cuota. */}
      <MejoresJugadas predictions={predictions} home={f.home.name} away={f.away.name} locale={locale} markedIds={markedIds} locked={locked} aiPlays={aiPlays} />

      <section aria-labelledby="mercados">
        <h2 id="mercados" className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          {t('markets')}
        </h2>
        <MercadosList predictions={predictions} home={f.home.name} away={f.away.name} locale={locale} markedIds={markedIds} locked={locked} />
        {top?.small_sample && <p className="mt-2 text-xs text-muted">{t('smallSample')}</p>}
        {missingMarkets.length > 0 && <p className="mt-2 text-xs text-muted">{t('missingMarkets', { markets: missingMarkets.map((m) => marketName(m, locale)).join(', ') })}</p>}
      </section>

      {/* 2. Por qué: lectura, revisión IA y análisis web, después de las cuotas. */}
      <h2 className="pt-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('analysisTitle')}</h2>
      <FadeIn>
        <section className="card p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('lectura')}</p>
          <p className="mt-2 max-w-lectura text-base leading-relaxed">{lectura ?? <span className="text-muted">{t('lecturaPending')}</span>}</p>
        </section>
      </FadeIn>

      {review && <RevisionIA review={review} />}

      {analysis?.ai_web && <AnalisisWeb analysis={analysis.ai_web} home={f.home.name} away={f.away.name} />}

      {analysis?.scores && <Marcador scores={analysis.scores} home={f.home.name} away={f.away.name} />}

      <FormaBlock home={f.home} away={f.away} hs={homeStats} as={awayStats} />

      <Comparador odds={odds} home={f.home.name} away={f.away.name} />

      <TeamHistory home={f.home} away={f.away} hist={teamHistory} />
    </article>
  );
}
