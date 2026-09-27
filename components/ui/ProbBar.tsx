'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Barra de probabilidad: width 0→valor, 500ms, cubic-bezier(0.22,1,0.36,1). */
export function ProbBar({ value, className, accent = false, height = 4 }: { value: number; className?: string; accent?: boolean; height?: number }) {
  const reduce = useReducedMotion();
  const pctValue = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-hover', className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(pctValue)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn('h-full rounded-full', accent ? 'bg-ventaja' : 'bg-[var(--text-faint)]')}
        initial={reduce ? { width: `${pctValue}%` } : { width: 0 }}
        animate={{ width: `${pctValue}%` }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
