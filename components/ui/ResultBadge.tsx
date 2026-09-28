import type { PickResult } from '@/lib/db/types';
import { cn } from '@/lib/utils';

const STYLES: Record<PickResult | 'pendiente', { mark: string; className: string }> = {
  acierto: { mark: '✓', className: 'border-[var(--ventaja-dim)] bg-[var(--ventaja-bg)] text-acierto' },
  fallo: { mark: '✗', className: 'border-transparent bg-[rgba(229,72,77,0.12)] text-fallo' },
  nulo: { mark: '–', className: 'border-transparent bg-[var(--sello-baja-bg)] text-nulo' },
  pendiente: { mark: '•', className: 'border-border bg-elevated text-muted' },
};

export interface ResultLabels {
  pendiente: string;
  acierto: string;
  fallo: string;
  nulo: string;
}

/** Resultado final de un pick, jugada o combinada. El texto acompaña siempre al color. */
export function ResultBadge({ result, labels, className }: { result: PickResult | null; labels: ResultLabels; className?: string }) {
  const key = result ?? 'pendiente';
  const { mark, className: style } = STYLES[key];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-xs font-semibold', style, className)}>
      <span aria-hidden="true">{mark}</span>
      {labels[key]}
    </span>
  );
}
