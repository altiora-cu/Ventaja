'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { removePlay } from '@/app/actions/jugadas';
import { IconX } from '@/components/ui/Icons';

/** Quita una jugada o combinada pendiente. Solo se ofrece antes del pitazo. */
export function RemovePlayButton({ kind, id }: { kind: 'jugada' | 'combinada'; id: number }) {
  const t = useTranslations('jugadas');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await removePlay(kind, id);
      if (!res.ok) setError(res.error ?? null);
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" className="btn btn-ghost btn-sm gap-1.5 px-2.5" onClick={onClick} disabled={pending}>
        <IconX width={15} height={15} />
        {t('remove')}
      </button>
      {error && (
        <span role="alert" className="max-w-[200px] text-right text-xs text-fallo">
          {error}
        </span>
      )}
    </span>
  );
}
