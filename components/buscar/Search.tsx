'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { StaggerItem, StaggerList } from '@/components/ui/Motion';
import { IconSearch } from '@/components/ui/Icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { selectionLabel } from '@/lib/labels';
import { isFinished } from '@/lib/data/statuses';
import { fmtDate, odds } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface Result {
  id: number;
  kickoff: string;
  status: string;
  league: string;
  home: { name: string; logo: string | null };
  away: { name: string; logo: string | null };
  home_goals: number | null;
  away_goals: number | null;
  pick: { market: string; selection: string; line: number | null; player_name: string | null; result: 'acierto' | 'fallo' | 'nulo'; price: number | null } | null;
  top: { market: string; selection: string; line: number | null; player_name?: string | null; best_price: number | null; sello: string } | null;
}

export function Search({ locked, timeZone }: { locked: boolean; timeZone: string }) {
  const t = useTranslations('buscar');
  const locale = useLocale() as Locale;
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(async () => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ac.signal });
        setResults((await res.json()) as Result[]);
      } catch {
        /* abortado */
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  const past = (results ?? []).filter((r) => isFinished(r.status));
  const upcoming = (results ?? []).filter((r) => !isFinished(r.status));

  const Row = ({ r }: { r: Result }) => {
    const done = isFinished(r.status);
    const ctx = { home: r.home.name, away: r.away.name };
    return (
      <StaggerItem>
        <Link href={locked && !done ? '/activar' : `/partido/${r.id}`} className="card card-interactive block p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{r.league}</span>
            <span className="num">{fmtDate(r.kickoff, locale, { day: 'numeric', month: 'short', year: 'numeric' }, timeZone)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-medium">
              {r.home.name} <span className="text-faint">vs</span> {r.away.name}
            </p>
            {done && (
              <span className="num text-lg">
                {r.home_goals}–{r.away_goals}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            {done ? (
              r.pick ? (
                <>
                  <span className="min-w-0 truncate text-muted">
                    {t('ventajaPick')}: {selectionLabel(r.pick.market, r.pick.selection, r.pick.line, { ...ctx, player: r.pick.player_name }, locale)} @ {odds(r.pick.price)}
                  </span>
                  <span className={`shrink-0 font-medium ${r.pick.result === 'acierto' ? 'text-acierto' : r.pick.result === 'fallo' ? 'text-fallo' : 'text-nulo'}`}>{t(r.pick.result === 'acierto' ? 'hit' : r.pick.result === 'fallo' ? 'miss' : 'void')}</span>
                </>
              ) : (
                <span className="text-faint">{t('noPick')}</span>
              )
            ) : r.top ? (
              <span className={`min-w-0 truncate text-muted ${locked ? 'locked' : ''}`}>{selectionLabel(r.top.market, r.top.selection, r.top.line, { ...ctx, player: r.top.player_name }, locale)} @ {odds(r.top.best_price)}</span>
            ) : (
              <span className="text-faint">—</span>
            )}
          </div>
        </Link>
      </StaggerItem>
    );
  };

  return (
    <div className="space-y-4">
      <label className="relative block">
        <IconSearch width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('placeholder')} className="input pl-10" autoComplete="off" autoFocus aria-label={t('title')} />
      </label>
      <p className="text-xs text-faint">{t('hint')}</p>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {!loading && results && (
        <>
          <p className="text-sm text-muted">{t('results', { count: results.length })}</p>
          {results.length === 0 && <p className="text-faint">{t('noResults')}</p>}
          {upcoming.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('upcoming')}</h2>
              <StaggerList className="space-y-2">{upcoming.map((r) => <Row key={r.id} r={r} />)}</StaggerList>
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('past')}</h2>
              <StaggerList className="space-y-2">{past.map((r) => <Row key={r.id} r={r} />)}</StaggerList>
            </section>
          )}
        </>
      )}
    </div>
  );
}
