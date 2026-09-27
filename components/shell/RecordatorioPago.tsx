'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { IconWhatsApp } from '@/components/ui/Icons';

/**
 * Modal de recordatorio de pago. Se muestra en cada sesión nueva (decidido en servidor por last_seen_at).
 * fade + scale 0.96→1, overlay 0→0.6, 240ms cubic-bezier(0.22,1,0.36,1).
 */
export function RecordatorioPago({ days, isRenewal, whatsappUrl }: { days: number; isRenewal: boolean; whatsappUrl: string }) {
  const t = useTranslations('recordatorio');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();

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

  const daysLabel = tc('days', { count: Math.max(days, 0) });
  const title = days <= 0 ? t('titleToday') : isRenewal ? t('renewTitle', { days: daysLabel }) : t('title', { days: daysLabel });
  const body = isRenewal ? t('renewBody') : t('body');

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="recordatorio-title">
          <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }} onClick={() => setOpen(false)} />
          <motion.div
            className="relative w-full max-w-md rounded-lg border border-border-strong bg-elevated p-6 shadow-modal"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--warning)]">{tc('appName')}</p>
            <h2 id="recordatorio-title" className="mt-2 text-xl font-semibold">
              {title}
            </h2>
            <p className="mt-2 text-muted">{body}</p>
            <div className="mt-6 flex flex-col gap-2">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <IconWhatsApp width={18} height={18} />
                {tc('whatsappCta')}
              </a>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                {t('later')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
