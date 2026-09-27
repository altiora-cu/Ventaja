'use client';

import { useTranslations } from 'next-intl';
import { CountUp } from '@/components/ui/CountUp';
import type { FixtureAnalysis } from '@/lib/db/types';

export function Marcador({ scores, home, away }: { scores: NonNullable<FixtureAnalysis['scores']>; home: string; away: string }) {
  const t = useTranslations('partido');
  if (!scores.length) return null;
  const [top, ...rest] = scores;
  return (
    <section className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('probableScore')}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="num text-2xl">
            {top.home}–{top.away}
          </span>
          <span className="text-sm text-muted">
            {home} · {away}
          </span>
        </div>
        <CountUp value={top.prob * 100} suffix="%" decimals={0} className="text-2xl text-ventaja" />
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {rest.map((s) => (
          <li key={`${s.home}-${s.away}`} className="rounded-sm border border-border bg-bg px-3 py-2 text-center">
            <p className="num text-lg">
              {s.home}–{s.away}
            </p>
            <p className="num text-xs text-muted">{Math.round(s.prob * 100)}%</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
