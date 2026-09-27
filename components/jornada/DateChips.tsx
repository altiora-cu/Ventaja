'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { Locale } from '@/i18n/config';

export interface DateChip {
  key: string; // AAAA-MM-DD
  label: string; // ya formateado (weekday + día) o clave especial
  offset: number; // -7..7
}

/** Selector de fecha: chips horizontales scrollables (hoy por defecto, ±7 días). */
export function DateChips({ chips, active, league, locale }: { chips: DateChip[]; active: string; league?: string; locale: Locale }) {
  const t = useTranslations('jornada');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' as ScrollBehavior });
  }, [active]);
  void locale;
  return (
    <div ref={ref} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label={t('title')}>
      {chips.map((c) => {
        const label = c.offset === 0 ? t('today') : c.offset === 1 ? t('tomorrow') : c.offset === -1 ? t('yesterday') : c.label;
        const params = new URLSearchParams();
        if (c.offset !== 0) params.set('fecha', c.key);
        if (league) params.set('liga', league);
        const qs = params.toString();
        return (
          <Link key={c.key} href={qs ? `/?${qs}` : '/'} className="chip" data-active={c.key === active} role="tab" aria-selected={c.key === active} scroll={false}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
