'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Sello } from '@/components/ui/Sello';
import { ProbBar } from '@/components/ui/ProbBar';
import { IconChevron } from '@/components/ui/Icons';
import type { Prediction } from '@/lib/db/types';
import { MARKET_ORDER, MARKETS_OPEN_BY_DEFAULT, type MarketKey } from '@/lib/engine/types';
import { marketName, selectionLabel } from '@/lib/labels';
import { odds, pct, signedPct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface Props {
  predictions: Prediction[];
  home: string;
  away: string;
  locale: Locale;
}

/** Orden de filas dentro de cada mercado. */
function sortRows(market: string, rows: Prediction[]): Prediction[] {
  const order: Record<string, number> = { home: 0, draw: 1, away: 2, '1X': 0, '12': 1, X2: 2, yes: 0, no: 1 };
  return [...rows].sort((a, b) => {
    if (market === 'scorer' || market === 'player_sot') return Number(b.prob) - Number(a.prob);
    const la = a.line ?? 0;
    const lb = b.line ?? 0;
    if (la !== lb) return la - lb;
    const sa = order[a.selection] ?? (a.selection.includes('over') ? 0 : 1);
    const sb = order[b.selection] ?? (b.selection.includes('over') ? 0 : 1);
    return sa - sb || a.selection.localeCompare(b.selection);
  });
}

export function MercadosList({ predictions, home, away, locale }: Props) {
  const t = useTranslations('partido');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Set<string>>(() => new Set(MARKETS_OPEN_BY_DEFAULT));

  const groups = useMemo(() => {
    const map = new Map<MarketKey, Prediction[]>();
    for (const p of predictions) {
      const k = p.market as MarketKey;
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return MARKET_ORDER.filter((m) => map.has(m)).map((m) => ({ market: m, rows: sortRows(m, map.get(m)!) }));
  }, [predictions]);

  const toggle = (m: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  if (!groups.length) return <p className="text-muted">{t('noPredictions')}</p>;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(new Set(groups.map((g) => g.market)))}>
          {t('openAll')}
        </button>
      </div>
      {groups.map(({ market, rows }) => {
        const isOpen = open.has(market);
        const best = rows.reduce<Prediction | null>((acc, r) => (r.edge !== null && (acc === null || Number(r.edge) > Number(acc.edge ?? -1)) ? r : acc), null);
        return (
          <motion.section key={market} layout={!reduce} className="card overflow-hidden">
            <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-hover" onClick={() => toggle(market)} aria-expanded={isOpen} aria-controls={`m-${market}`}>
              <span className="font-medium">{marketName(market, locale)}</span>
              <span className="flex items-center gap-3">
                {best && !isOpen && <Sello nivel={best.sello} animate={false} />}
                <IconChevron width={18} height={18} className={`text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div id={`m-${market}`} initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
                  <div className="border-t border-border">
                    <div className="hidden grid-cols-[1fr_88px_110px_88px_84px] gap-2 px-4 pt-3 text-xs uppercase tracking-[0.04em] text-faint sm:grid">
                      <span>{tc('market')}</span>
                      <span className="text-right">{tc('probability')}</span>
                      <span className="text-right">{tc('bestOdds')}</span>
                      <span className="text-right">{tc('edge')}</span>
                      <span aria-hidden="true" />
                    </div>
                    <ul className="divide-y divide-border">
                      {rows.map((r) => {
                        const label = selectionLabel(r.market, r.selection, r.line, { home, away, player: r.player_name }, locale);
                        return (
                          <li key={`${r.selection}-${r.line}-${r.player_id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[1fr_88px_110px_88px_84px] sm:gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm">{label}</p>
                              <ProbBar value={Number(r.prob)} className="mt-1.5 max-w-[160px]" accent={r.sello !== 'baja'} height={3} />
                            </div>
                            <div className="flex items-center gap-3 sm:contents">
                              <span className="num text-right text-sm">{pct(Number(r.prob))}</span>
                              <span className="num text-right text-sm text-muted">
                                {odds(r.best_price)}
                                {r.best_bookmaker && <span className="ml-1 hidden text-xs text-faint lg:inline">{r.best_bookmaker}</span>}
                              </span>
                              <span className={`num text-right text-sm ${r.edge !== null && Number(r.edge) > 0 ? 'text-ventaja' : 'text-muted'}`}>{r.edge === null ? '—' : signedPct(Number(r.edge))}</span>
                              <span className="flex justify-end">
                                <Sello nivel={r.sello} animate={false} />
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        );
      })}
    </div>
  );
}
