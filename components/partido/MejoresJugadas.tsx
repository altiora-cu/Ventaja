import { getTranslations } from 'next-intl/server';
import { MarkButton } from '@/components/jugadas/MarkButton';
import { AiVerdictNote } from '@/components/ui/AiVerdictNote';
import { ProbBar } from '@/components/ui/ProbBar';
import { Sello } from '@/components/ui/Sello';
import type { AiPlayReview, Prediction } from '@/lib/db/types';
import { bestPlays, probablePlays, rejectedByAi, riskLevel, toPlayCandidate } from '@/lib/engine/best-plays';
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

/**
 * Qué jugar en este partido. Si hay jugadas con ventaja sobre la cuota, se muestran esas; si no, las más probables
 * según el modelo, dicho con claridad. Nunca un cartel vacío: quien abre un partido quiere ver por dónde va.
 */
export async function MejoresJugadas({ predictions, home, away, locale, markedIds, locked, aiPlays }: Props) {
  const [t, tc, tv] = await Promise.all([getTranslations('partido'), getTranslations('common'), getTranslations('aiVerdict')]);
  const candidates = predictions.map(toPlayCandidate);
  const rejected = rejectedByAi(candidates, aiPlays);
  const value = bestPlays(candidates, undefined, rejected);
  const withValue = value.length > 0;
  const plays = withValue ? value : probablePlays(candidates, undefined, rejected);
  const reviews = verdictsByKey(aiPlays);
  const aiLabels = { title: t('aiReview'), concuerda: tv('concuerda'), cautela: tv('cautela'), discrepa: tv('discrepa'), missing: t('aiPlayMissing') };
  const marked = new Set(markedIds);
  const bookmaker = new Map(predictions.map((p) => [p.id, p.best_bookmaker]));
  const riskText = { bajo: t('riskBajo'), medio: t('riskMedio'), alto: t('riskAlto') };

  // Sin predicciones o partido muy parejo: una línea, no una tarjeta vacía.
  if (plays.length === 0) {
    return (
      <section aria-labelledby="mejores-jugadas">
        <h2 id="mejores-jugadas" className="text-lg font-semibold">
          {t('probableTitle')}
        </h2>
        <p className="mt-1 max-w-lectura text-sm text-muted">{predictions.length === 0 ? t('noPredictions') : t('probableNone')}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="mejores-jugadas" className="space-y-3">
      <div>
        <h2 id="mejores-jugadas" className="text-lg font-semibold">
          {withValue ? t('bestTitle') : t('probableTitle')}
        </h2>
        <p className="mt-1 max-w-lectura text-sm text-muted">{locked ? t('bestStarted') : withValue ? t('bestHint') : t('probableHint')}</p>
        {withValue && <p className="mt-1 max-w-lectura text-xs text-faint">{t('aiPlaysHint')}</p>}
      </div>

      <ol className="space-y-2">
        {plays.map((p, i) => {
          const risk = riskLevel(p.prob);
          const review = reviews.get(selectionKey(p.market, p.selection, p.line, p.player_id));
          const sello = review?.sello_final ?? p.sello;
          const book = bookmaker.get(p.id);
          return (
            <li key={p.id} className={cn('card grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_1fr_auto]', i === 0 && withValue && 'border-[var(--ventaja-dim)]')}>
              <span className="num row-span-2 text-2xl text-faint sm:row-span-1 sm:self-center" aria-hidden="true">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted">{marketName(p.market, locale)}</p>
                <p className="mt-0.5 text-base font-medium leading-snug">{selectionLabel(p.market, p.selection, p.line, { home, away, player: p.player_name }, locale)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {withValue ? <Sello nivel={sello} animate={false} /> : <span className="rounded-md border border-border bg-elevated px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('probableTag')}</span>}
                  <span className={cn('text-xs font-medium', risk === 'bajo' ? 'text-ventaja' : 'text-warning')}>{riskText[risk]}</span>
                </div>
                {withValue && <AiVerdictNote review={review} labels={aiLabels} className="mt-2 max-w-lectura" />}
              </div>
              <div className="col-start-2 flex flex-wrap items-end justify-between gap-3 sm:col-start-3 sm:flex-col sm:items-end sm:justify-center">
                <dl className="flex gap-5 text-right">
                  <div>
                    <dt className="text-xs text-faint">{tc('probability')}</dt>
                    <dd className={cn('num text-lg', withValue && 'text-ventaja')}>{pct(p.prob)}</dd>
                    <ProbBar value={p.prob} className="mt-1 w-16" height={3} accent={withValue} />
                  </div>
                  <div>
                    <dt className="text-xs text-faint">{tc('bestOdds')}</dt>
                    <dd className="num text-lg">{odds(p.best_price)}</dd>
                    {book && <dd className="max-w-[92px] truncate text-[11px] text-faint">{book}</dd>}
                  </div>
                  <div>
                    <dt className="text-xs text-faint">{tc('edge')}</dt>
                    <dd className={cn('num text-lg', p.edge !== null && p.edge > 0 ? '' : 'text-muted')}>{p.edge === null ? '—' : signedPct(p.edge)}</dd>
                  </div>
                </dl>
                <MarkButton predictionId={p.id} initialMarked={marked.has(p.id)} locked={locked} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
