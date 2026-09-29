import type { AiPlayReview } from '@/lib/db/types';
import { cn } from '@/lib/utils';

const COLOR: Record<AiPlayReview['verdict'], string> = {
  concuerda: 'text-ventaja',
  cautela: 'text-warning',
  discrepa: 'text-muted',
};

export interface AiVerdictLabels {
  title: string;
  concuerda: string;
  cautela: string;
  discrepa: string;
  /** Texto cuando la jugada todavía no tiene revisión. */
  missing: string;
}

/** Veredicto de la Revisión IA para una jugada. Sin rojo: "discrepa" se muestra en gris. */
export function AiVerdictNote({ review, labels, className }: { review: AiPlayReview | undefined; labels: AiVerdictLabels; className?: string }) {
  if (!review) return <p className={cn('text-xs text-faint', className)}>{labels.missing}</p>;
  return (
    <p className={cn('text-sm leading-snug text-muted', className)}>
      <span className={cn('font-semibold', COLOR[review.verdict])}>
        {labels.title}: {labels[review.verdict]}.
      </span>{' '}
      {review.note}
    </p>
  );
}
