'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { updatePreferences } from '@/app/actions/preferencias';
import { IconCheck } from '@/components/ui/Icons';
import type { Currency } from '@/lib/db/types';
import { CURRENCIES, MAX_STAKE } from '@/lib/engine/money';
import { cn } from '@/lib/utils';

interface Props {
  currency: Currency;
  defaultStake: number;
  notifyKickoff: boolean;
  notifyResults: boolean;
}

/** Moneda, stake por defecto y qué avisos recibir. Cada cambio se guarda al instante. */
export function PreferencesForm({ currency: initialCurrency, defaultStake, notifyKickoff, notifyResults }: Props) {
  const t = useTranslations('preferencias');
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [stake, setStake] = useState(String(defaultStake));
  const [kickoff, setKickoff] = useState(notifyKickoff);
  const [results, setResults] = useState(notifyResults);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (input: Parameters<typeof updatePreferences>[0]) =>
    start(async () => {
      const res = await updatePreferences(input);
      setStatus(res.ok ? 'saved' : 'error');
      setError(res.ok ? null : (res.error ?? null));
    });

  const commitStake = () => {
    const n = Number(stake.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > MAX_STAKE) {
      setStatus('error');
      setError(t('stakeInvalid'));
      return;
    }
    if (n === defaultStake) return;
    save({ defaultStake: n });
  };

  const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) => (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-faint">{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={checked} disabled={pending} onClick={() => onChange(!checked)} className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors', checked ? 'border-[var(--ventaja-dim)] bg-[var(--ventaja-dim)]' : 'border-border bg-bg')}>
        <span className={cn('absolute top-0.5 h-4.5 w-4.5 rounded-full bg-text transition-transform', checked ? 'left-[22px]' : 'left-0.5')} style={{ height: 18, width: 18 }} />
      </button>
    </label>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs text-muted">{t('currency')}</p>
        <div className="flex gap-2" role="radiogroup" aria-label={t('currency')}>
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={currency === c}
              className="chip"
              data-active={currency === c}
              disabled={pending}
              onClick={() => {
                setCurrency(c);
                save({ currency: c });
              }}
            >
              {c === 'USD' ? t('usd') : t('pen')}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-faint">{t('currencyHint')}</p>
      </div>

      <div>
        <label className="mb-2 block text-xs text-muted" htmlFor="default-stake">
          {t('defaultStake')}
        </label>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 items-center rounded-sm border border-border bg-bg px-3 focus-within:border-[var(--ventaja-dim)]">
            <span className="num mr-1 text-sm text-muted">{currency === 'PEN' ? 'S/' : '$'}</span>
            <input id="default-stake" type="number" inputMode="decimal" min={0.5} max={MAX_STAKE} step={0.5} value={stake} onChange={(e) => setStake(e.target.value)} onBlur={commitStake} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} disabled={pending} className="num w-24 bg-transparent text-sm outline-none" />
          </span>
        </div>
        <p className="mt-1 text-xs text-faint">{t('defaultStakeHint')}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted">{t('notifications')}</p>
        <Toggle
          checked={kickoff}
          onChange={(v) => {
            setKickoff(v);
            save({ notifyKickoff: v });
          }}
          label={t('notifyKickoff')}
          hint={t('notifyKickoffHint')}
        />
        <Toggle
          checked={results}
          onChange={(v) => {
            setResults(v);
            save({ notifyResults: v });
          }}
          label={t('notifyResults')}
          hint={t('notifyResultsHint')}
        />
      </div>

      {status === 'saved' && (
        <p className="flex items-center gap-1 text-xs text-ventaja" role="status">
          <IconCheck width={14} height={14} /> {t('saved')}
        </p>
      )}
      {status === 'error' && error && (
        <p className="text-xs text-[var(--warning)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
