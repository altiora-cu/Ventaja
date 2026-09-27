import { getTranslations } from 'next-intl/server';
import { Sello } from '@/components/ui/Sello';
import type { AiReview } from '@/lib/db/types';

const COLOR: Record<AiReview['verdict'], string> = {
  concuerda: 'text-ventaja',
  cautela: 'text-[var(--warning)]',
  discrepa: 'text-muted',
};

/** Tarjeta de Revisión IA: veredicto, riesgos, nota y sello final. Sin rojo: discrepa se muestra en gris. */
export async function RevisionIA({ review }: { review: AiReview }) {
  const t = await getTranslations('partido');
  const tv = await getTranslations('aiVerdict');
  const ts = await getTranslations('sello');
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('aiReview')}</p>
        <span className={`text-sm font-semibold ${COLOR[review.verdict]}`}>
          {t('aiVerdictLabel')}: {tv(review.verdict)}
        </span>
      </div>
      <p className="mt-2 max-w-lectura text-base leading-relaxed">{review.note}</p>
      {review.risks.length > 0 && (
        <>
          <p className="mt-3 text-xs text-faint">{t('aiRisks')}</p>
          <ul className="mt-1 space-y-1">
            {review.risks.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </>
      )}
      {review.sello_final !== review.sello_modelo && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Sello nivel={review.sello_modelo} animate={false} />
          <span aria-hidden="true">→</span>
          <Sello nivel={review.sello_final} animate={false} />
          <span className="sr-only">{t('aiSelloNote', { modelo: ts(review.sello_modelo), final: ts(review.sello_final) })}</span>
        </p>
      )}
      <p className="mt-3 text-xs text-faint">{t('aiDisclaimer')}</p>
    </section>
  );
}
