'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { removePlay } from '@/app/actions/jugadas';
import { IconX } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

const CONFIRM_MS = 3500;

/** Quita una jugada o combinada pendiente. Pide un segundo toque para confirmar: cerca del pitazo un toque por error cuesta la jugada. */
export function RemovePlayButton({ kind, id }: { kind: 'jugada' | 'combinada'; id: number }) {
  const t = useTranslations('jugadas');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!confirm) return;
    const timer = setTimeout(() => setConfirm(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirm]);

  const onClick = () => {
    if (!confirm) return setConfirm(true);
    setConfirm(false);
    setError(null);
    startTransition(async () => {
      const res = await removePlay(kind, id);
      if (!res.ok) setError(res.error ?? null);
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" className={cn('btn btn-sm gap-1.5 px-2.5', confirm ? 'border border-[var(--warning)] text-[var(--warning)]' : 'btn-ghost')} onClick={onClick} disabled={pending} aria-live="polite">
        <IconX width={15} height={15} />
        {confirm ? t('confirmRemove') : t('remove')}
      </button>
      {error && (
        <span role="alert" className="max-w-[200px] text-right text-xs text-[var(--warning)]">
          {error}
        </span>
      )}
    </span>
  );
}
