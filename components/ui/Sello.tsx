'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { Sello as SelloNivel } from '@/lib/db/types';
import { cn } from '@/lib/utils';

const STYLES: Record<SelloNivel, string> = {
  alta: 'bg-[var(--ventaja-bg)] border-[var(--ventaja-dim)] text-[var(--sello-alta)]',
  media: 'bg-[var(--sello-media-bg)] border-transparent text-[var(--sello-media)]',
  baja: 'bg-[var(--sello-baja-bg)] border-transparent text-[var(--sello-baja)]',
};

/**
 * Sello de Confianza: pill 24px, radio 8px, text-xs 600 mayúsculas, tracking 0.06em, punto 6px.
 * Nunca rojo: BAJA es gris.
 */
export function Sello({ nivel, className, animate = true }: { nivel: SelloNivel; className?: string; animate?: boolean }) {
  const t = useTranslations('sello');
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={animate && !reduce ? { opacity: 0, scale: 0.92 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn('inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs font-semibold uppercase tracking-[0.06em] whitespace-nowrap', STYLES[nivel], className)}
      title={t('help')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(nivel)}
    </motion.span>
  );
}
