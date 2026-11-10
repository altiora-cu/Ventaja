'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { setPlayStake } from '@/app/actions/jugadas';
import type { Currency } from '@/lib/db/types';
import { MAX_STAKE } from '@/lib/engine/money';
import { cn } from '@/lib/utils';

interface Props {
  kind: 'jugada' | 'combinada';
  id: number;
  value: number | null;
  currency: Currency;
  className?: string;
}

/** Dinero apostado en una jugada en juego. Se guarda al salir del campo o con Enter. */
export function StakeInput({ kind, id, value, currency, className }: Props) {
  const t = useTranslations('stake');
  const [text, setText] = useState(value === null ? '' : String(value));
  const [saved, setSaved] = useState<number | null>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSaved(value);
    setText(value === null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const n = Number(text.replace(',', '.'));
    if (!text || !Number.isFinite(n) || n <= 0 || n > MAX_STAKE) {
      setError(t('invalid'));
      return;
    }
    if (saved !== null && Math.abs(n - saved) < 0.005) return;
    setError(null);
    startTransition(async () => {
      const res = await setPlayStake(kind, id, n);
      if (res.ok) setSaved(n);
      else setError(res.error ?? t('invalid'));
    });
  };

  return (
    <label className={cn('inline-flex flex-col items-end gap-0.5', className)}>
      <span className="text-[10px] uppercase tracking-[0.04em] text-faint">{t('label')}</span>
      <span className="inline-flex h-8 items-center rounded-sm border border-border bg-bg px-2 focus-within:border-[var(--ventaja-dim)]">
        <span className="num mr-1 text-xs text-muted">{currency === 'PEN' ? 'S/' : '$'}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0.5}
          max={MAX_STAKE}
          step={0.5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          disabled={pending}
          aria-label={t('label')}
          className="num w-16 bg-transparent text-right text-sm outline-none"
        />
      </span>
      {error && (
        <span role="alert" className="text-xs text-[var(--warning)]">
          {error}
        </span>
      )}
    </label>
  );
}
