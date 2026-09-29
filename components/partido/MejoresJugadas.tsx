import { getTranslations } from 'next-intl/server';
import { MarkButton } from '@/components/jugadas/MarkButton';
import { AiVerdictNote } from '@/components/ui/AiVerdictNote';
import { ProbBar } from '@/components/ui/ProbBar';
import { Sello } from '@/components/ui/Sello';
import type { AiPlayReview, Prediction } from '@/lib/db/types';
import { bestPlays, rejectedByAi, riskLevel, toPlayCandidate } from '@/lib/engine/best-plays';
import { selectionKey } from '@/lib/engine/edge';
import { verdictsByKey } from '@/lib/engine/plays-review';
import { marketName, selectionLabel } from '@/lib/labels';
import { cn, odds, pct, signedPct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface Props {
  predictions: Prediction[];
  home: string;
  away: string;
  locale: Locale;
  markedIds: number[];
  /** El partido ya empezó o terminó. */
  locked: boolean;
  /** Revisión IA de las jugadas recomendadas; null si aún no se generó. */
  aiPlays: AiPlayReview[] | null;
}

/** Vista corta de la ficha: solo las jugadas con ventaja y riesgo bajo o medio. */
export async function MejoresJugadas({ predictions, home, away, locale, markedIds, locked, aiPlays }: Props) {
  const [t, tc, tv] = await Promise.all([getTranslations('partido'), getTranslations('common'), getTranslations('aiVerdict')]);
  const candidates = predictions.map(toPlayCandidate);
  const plays = bestPlays(candidates, undefined, rejectedByAi(candidates, aiPlays));
  const reviews = verdictsByKey(aiPlays);
  const aiLabels = { title: t('aiReview'), concuerda: tv('concuerda'), cautela: tv('cautela'), discrepa: tv('discrepa'), missing: t('aiPlayMissing') };
  const marked = new Set(markedIds);

  return (
    <section aria-labelledby="mejores-jugadas" className="space-y-3">
      <div>
        <h2 id="mejores-jugadas" className="text-lg font-semibold">
          {t('bestTitle')}
        </h2>
        <p className="mt-1 max-w-lectura text-sm text-muted">{locked ? t('bestStarted') : t('bestHint')}</p>
        <p className="mt-1 max-w-lectura text-xs text-faint">{t('aiPlaysHint')}</p>
      </div>

      {plays.length === 0 ? (
        <p className="card p-6 text-center text-muted">{t('bestEmpty')}</p>
      ) : (
        <ol className="space-y-2">
          {plays.map((p, i) => {
            const risk = riskLevel(p.prob);
            const review = reviews.get(selectionKey(p.market, p.selection, p.line, p.player_id));
            const sello = review?.sello_final ?? p.sello;
            return (
              <li key={p.id} className={cn('card grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_1fr_auto]', i === 0 && 'border-[var(--ventaja-dim)]')}>
                <span className="num row-span-2 text-2xl text-faint sm:row-span-1 sm:self-center" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted">{marketName(p.market, locale)}</p>
                  <p className="mt-0.5 text-base font-medium leading-snug">{selectionLabel(p.market, p.selection, p.line, { home, away, player: p.player_name }, locale)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Sello nivel={sello} animate={false} />
                    <span className={cn('text-xs font-medium', risk === 'bajo' ? 'text-ventaja' : 'text-warning')}>{risk === 'bajo' ? t('riskBajo') : t('riskMedio')}</span>
                  </div>
                  <AiVerdictNote review={review} labels={aiLabels} className="mt-2 max-w-lectura" />
                </div>
                <div className="col-start-2 flex flex-wrap items-end justify-between gap-3 sm:col-start-3 sm:flex-col sm:items-end sm:justify-center">
                  <dl className="flex gap-5 text-right">
                    <div>
                      <dt className="text-xs text-faint">{tc('probability')}</dt>
                      <dd className="num text-lg text-ventaja">{pct(p.prob)}</dd>
                      <ProbBar value={p.prob} className="mt-1 w-16" height={3} accent />
                    </div>
                    <div>
                      <dt className="text-xs text-faint">{tc('bestOdds')}</dt>
                      <dd className="num text-lg">{odds(p.best_price)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-faint">{tc('edge')}</dt>
                      <dd className="num text-lg">{signedPct(p.edge)}</dd>
                    </div>
                  </dl>
                  <MarkButton predictionId={p.id} initialMarked={marked.has(p.id)} locked={locked} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
