'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { removePlay, saveComboFromPicks } from '@/app/actions/jugadas';
import { IconBookmark, IconCheck, IconX } from '@/components/ui/Icons';
import { StakeInput } from '@/components/jugadas/StakeInput';
import type { Currency } from '@/lib/db/types';
import { fmtMoney, payout } from '@/lib/engine/money';
import { boletoTotals, MIN_COMBO_LEGS } from '@/lib/engine/boleto';
import { cn, odds, pct } from '@/lib/utils';

export interface BoletoPlay {
  id: number;
  fixtureId: number;
  match: string;
  /** Hora del pitazo ya formateada en la zona del usuario. */
  time: string;
  label: string;
  prob: number;
  price: number | null;
  stake: number | null;
  /** null si el modelo la recomienda; si no, el motivo. */
  warning: 'baja' | 'discrepa' | null;
}

interface Props {
  plays: BoletoPlay[];
  openCombos: number;
  currency: Currency;
  /** Stake por defecto del perfil: el que llevará la combinada al guardarla. */
  defaultStake: number;
  locale: 'es' | 'en';
}

/** Rutas donde la burbuja sobra: ya estás en Mis jugadas, o estás entrando/pagando. */
const HIDDEN_PREFIXES = ['/mis-jugadas', '/login', '/registro', '/activar', '/auth', '/legal'];
const SCROLL_HIDE_DELTA = 8;

/** Se esconde al bajar y reaparece al subir, para no tapar el contenido mientras se lee. */
function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setHidden(false);
      else if (y - last > SCROLL_HIDE_DELTA) setHidden(true);
      else if (last - y > SCROLL_HIDE_DELTA) setHidden(false);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}

/**
 * Burbuja flotante con las jugadas en juego: cuántas van y la cuota combinada.
 * Al tocar, abre un boleto con el detalle, permite quitar jugadas y guardarlas como combinada propia.
 */
export function BoletoFlotante({ plays: initialPlays, openCombos, currency, defaultStake, locale }: Props) {
  const t = useTranslations('boleto');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const scrollHidden = useHideOnScroll();
  const [open, setOpen] = useState(false);
  const [plays, setPlays] = useState(initialPlays);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comboState, setComboState] = useState<'idle' | 'saved'>('idle');
  const [pending, startTransition] = useTransition();

  // El servidor manda la lista fresca tras cada acción (revalidatePath del layout).
  useEffect(() => setPlays(initialPlays), [initialPlays]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (confirmId === null) return;
    const id = setTimeout(() => setConfirmId(null), 3500);
    return () => clearTimeout(id);
  }, [confirmId]);

  const totals = useMemo(() => boletoTotals(plays), [plays]);
  const flagged = plays.filter((p) => p.warning !== null);
  const comboPayout = totals.totalPrice === null ? null : payout(defaultStake, totals.totalPrice);

  const hiddenRoute = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const count = plays.length;
  if (hiddenRoute || (count === 0 && openCombos === 0)) return null;

  const remove = (id: number) => {
    if (confirmId !== id) return setConfirmId(id);
    setConfirmId(null);
    setError(null);
    const previous = plays;
    setPlays((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      const res = await removePlay('jugada', id);
      if (!res.ok) {
        setPlays(previous);
        setError(res.error ?? null);
      }
    });
  };

  const saveAsCombo = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveComboFromPicks(plays.map((p) => p.id));
      if (res.ok) setComboState('saved');
      else setError(res.error ?? null);
    });
  };

  const pillLabel = count > 0 ? t('pill', { count }) : t('pillCombos', { count: openCombos });

  return (
    <>
      <AnimatePresence>
        {!open && !scrollHidden && (
          <motion.button
            key="pill"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('openLabel', { count })}
            aria-haspopup="dialog"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-4 z-20 flex h-12 items-center gap-2.5 rounded-full border border-[var(--ventaja-dim)] bg-elevated pl-3.5 pr-4 text-sm shadow-modal hover:bg-hover lg:bottom-6"
            style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)' }}
          >
            <IconBookmark width={16} height={16} className="text-ventaja" />
            <motion.span key={count} initial={reduce ? false : { scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="num font-semibold">
              {pillLabel}
            </motion.span>
            {totals.totalPrice !== null && (
              <span className="num text-muted">
                @<span className="text-text">{odds(totals.totalPrice)}</span>
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="boleto-title">
            <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setOpen(false)} />
            <motion.div
              className="relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-lg border border-border-strong bg-elevated shadow-modal sm:rounded-lg"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 pt-5 pb-4">
                <div>
                  <h2 id="boleto-title" className="text-lg font-semibold">
                    {t('title')}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">{count > 0 ? t('subtitle', { count }) : t('subtitleEmpty')}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm -mr-2 px-2" onClick={() => setOpen(false)} aria-label={tc('close')}>
                  <IconX width={18} height={18} />
                </button>
              </div>

              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                {plays.map((p) => (
                  <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-3">
                    <div className="min-w-0">
                      <Link href={`/partido/${p.fixtureId}`} onClick={() => setOpen(false)} className="block truncate text-xs text-muted hover:text-text">
                        {p.match} · <span className="num">{p.time}</span>
                      </Link>
                      <p className="mt-0.5 truncate text-sm font-medium">{p.label}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="num text-sm">{odds(p.price)}</span>
                      <button type="button" onClick={() => remove(p.id)} disabled={pending} className={cn('btn btn-sm px-2', confirmId === p.id ? 'border border-[var(--warning)] text-[var(--warning)]' : 'btn-ghost text-muted')} aria-label={t('removeLabel', { label: p.label })}>
                        {confirmId === p.id ? t('confirmRemove') : <IconX width={15} height={15} />}
                      </button>
                    </div>
                    <div className="col-span-2 flex items-end justify-between gap-3">
                      <span className="min-w-0 text-xs">
                        {p.warning ? (
                          <span className="text-[var(--warning)]">{p.warning === 'baja' ? t('warnBaja') : t('warnDiscrepa')}</span>
                        ) : (
                          <span className="text-faint">{p.stake !== null && p.price !== null ? t('payout', { amount: fmtMoney(payout(p.stake, p.price) ?? 0, currency, locale) }) : ''}</span>
                        )}
                      </span>
                      <StakeInput kind="jugada" id={p.id} value={p.stake} currency={currency} />
                    </div>
                  </li>
                ))}
                {count === 0 && <li className="py-6 text-center text-sm text-muted">{t('emptyPlays')}</li>}
              </ul>

              <div className="space-y-3 border-t border-border px-5 py-4">
                {count > 0 && (
                  <dl className="flex justify-between gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-faint">{t('jointProb')}</dt>
                      <dd className="num">{pct(totals.jointProb)}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-xs text-faint">{t('totalOdds')}</dt>
                      <dd className="num text-lg font-semibold">{totals.totalPrice === null ? t('noOdds') : odds(totals.totalPrice)}</dd>
                    </div>
                  </dl>
                )}
                {totals.canCombo && comboPayout !== null && <p className="text-xs text-muted">{t('comboPayout', { stake: fmtMoney(defaultStake, currency, locale), amount: fmtMoney(comboPayout, currency, locale) })}</p>}
                {flagged.length > 0 && (
                  <p className="rounded-sm border border-[var(--warning)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]" role="status">
                    {t('warnSummary', { count: flagged.length, total: count })}
                  </p>
                )}
                {openCombos > 0 && <p className="text-xs text-muted">{t('openCombos', { count: openCombos })}</p>}
                {totals.sameFixture && count >= MIN_COMBO_LEGS && <p className="text-xs text-muted">{t('sameFixture')}</p>}
                {error && (
                  <p role="alert" className="text-xs text-[var(--warning)]">
                    {error}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {totals.canCombo && (
                    <button type="button" className={cn('btn flex-1', comboState === 'saved' ? 'btn-secondary' : 'btn-primary')} onClick={saveAsCombo} disabled={pending || comboState === 'saved'}>
                      {comboState === 'saved' ? (
                        <>
                          <IconCheck width={16} height={16} />
                          {t('comboSaved')}
                        </>
                      ) : (
                        t('saveCombo')
                      )}
                    </button>
                  )}
                  <Link href="/mis-jugadas" onClick={() => setOpen(false)} className={cn('btn flex-1', totals.canCombo ? 'btn-secondary' : 'btn-primary')}>
                    {t('viewAll')}
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
