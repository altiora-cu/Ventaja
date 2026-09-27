'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Locale } from '@/i18n/config';
import { fmtDate, fmtUnits } from '@/lib/utils';

/** Línea de rendimiento acumulado: --ventaja, sin relleno. */
export function PerformanceChart({ series }: { series: Array<{ date: string; units: number }> }) {
  const t = useTranslations('historial');
  const locale = useLocale() as Locale;
  if (series.length < 2) return null;
  const fmt = (d: string) => fmtDate(`${d}T12:00:00Z`, locale, { day: 'numeric', month: 'short' }, 'UTC');
  return (
    <section className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('chart')}</p>
      <div className="mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtUnits(v)} width={56} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }}
              labelStyle={{ color: 'var(--text-muted)' }}
              itemStyle={{ color: 'var(--text)' }}
              labelFormatter={(l) => fmt(String(l))}
              formatter={(v) => [`${fmtUnits(Number(v))} ${t('units')}`, '']}
              cursor={{ stroke: 'var(--border-strong)' }}
            />
            <Line type="monotone" dataKey="units" stroke="var(--ventaja)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--ventaja)', stroke: 'var(--bg)' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
