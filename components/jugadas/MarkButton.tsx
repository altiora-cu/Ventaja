'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { togglePlay } from '@/app/actions/jugadas';
import { IconBookmark, IconCheck } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface Props {
  predictionId: number;
  initialMarked: boolean;
  /** El partido ya empezó: la jugada no se puede marcar ni quitar. */
  locked?: boolean;
  className?: string;
}

/** Marca o quita una jugada de "Mis jugadas". El estado se adelanta y se revierte si el servidor falla. */
export function MarkButton({ predictionId, initialMarked, locked = false, className }: Props) {
  const t = useTranslations('jugadas');
  const [marked, setMarked] = useState(initialMarked);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (locked && !marked) return null;

  const onClick = () => {
    const previous = marked;
    setError(null);
    setMarked(!previous);
    startTransition(async () => {
      const res = await togglePlay(predictionId);
      if (res.ok) return setMarked(res.marked ?? !previous);
      setMarked(res.marked ?? previous);
      setError(res.error ?? null);
    });
  };

  return (
    <span className={cn('inline-flex flex-col items-end gap-1', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || locked}
        aria-pressed={marked}
        title={locked ? t('locked') : marked ? t('unmarkHint') : t('markHint')}
        className={cn('btn btn-sm gap-1.5 px-2.5', marked ? 'border border-[var(--ventaja-dim)] bg-[var(--ventaja-bg)] text-ventaja' : 'btn-secondary')}
      >
        {marked ? <IconCheck width={15} height={15} /> : <IconBookmark width={15} height={15} />}
        {marked ? t('marked') : t('mark')}
      </button>
      {error && (
        <span role="alert" className="max-w-[180px] text-right text-xs text-fallo">
          {error}
        </span>
      )}
    </span>
  );
}
