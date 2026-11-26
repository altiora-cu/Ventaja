'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { saveCombo } from '@/app/actions/jugadas';
import { IconBookmark, IconCheck } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

/** Guarda en Mis jugadas una combinada ya armada (ids de predicciones, una por partido). */
export function SaveComboButton({ predictionIds, primary = false, className }: { predictionIds: number[]; primary?: boolean; className?: string }) {
  const t = useTranslations('jornada');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onClick = () => {
    setError(null);
    start(async () => {
      const res = await saveCombo(predictionIds, 'propia');
      if (res.ok) setSaved(true);
      else setError(res.error ?? null);
    });
  };
  return (
    <span className={cn('flex flex-col gap-1', className)}>
      <button type="button" className={cn('btn btn-sm w-full gap-1.5', saved ? 'btn-secondary' : primary ? 'btn-primary' : 'btn-secondary')} onClick={onClick} disabled={pending || saved}>
        {saved ? <IconCheck width={15} height={15} /> : <IconBookmark width={15} height={15} />}
        {saved ? t('comboSaved') : t('comboSave')}
      </button>
      {error && (
        <span role="alert" className="text-xs text-[var(--warning)]">
          {error}
        </span>
      )}
    </span>
  );
}
