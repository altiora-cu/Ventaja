'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

/** Cifra que cuenta de 0 al valor (600ms easeOut), en JetBrains Mono tabular. */
export function CountUp({ value, suffix = '', decimals = 0, className }: { value: number; suffix?: string; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = value.toFixed(decimals) + suffix;
      return;
    }
    const controls = animate(0, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = v.toFixed(decimals) + suffix;
      },
    });
    return () => controls.stop();
  }, [value, suffix, decimals, reduce]);
  return (
    <span ref={ref} className={`num ${className ?? ''}`}>
      {value.toFixed(decimals) + suffix}
    </span>
  );
}
