'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { saveCombo } from '@/app/actions/jugadas';
import { MarkButton } from '@/components/jugadas/MarkButton';
import { AiVerdictNote } from '@/components/ui/AiVerdictNote';
import { Sello } from '@/components/ui/Sello';
import { StaggerItem, StaggerList } from '@/components/ui/Motion';
import { IconBookmark, IconCopy, IconCheck } from '@/components/ui/Icons';
import { buildCombos, COMBO_RULES, type ComboKind, type ComboSelection } from '@/lib/engine/combos';
import type { AiPlayReview, Sello as SelloNivel } from '@/lib/db/types';
import { selectionLabel } from '@/lib/labels';
import { odds, pct, signedPct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';
import Link from 'next/link';

export interface PickRow extends ComboSelection {
  id: number;
  league_id: number;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  /** El partido ya empezó: la jugada se muestra pero no se puede marcar ni combinar. */
  started: boolean;
  /** Revisión IA de esta jugada; null si aún no se generó. */
  ai: AiPlayReview | null;
}

interface Props {
  rows: PickRow[];
  leagues: Array<{ id: number; name: string }>;
  locale: Locale;
  dateLabel: string;
  markedIds: number[];
}

/** Guarda combinadas en "Mis jugadas" y recuerda cuáles ya se guardaron en esta visita. */
function useSaveCombo() {
  const [saved, setSaved] = useState<ReadonlySet<ComboKind>>(new Set());
  const [error, setError] = useState<{ kind: ComboKind; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (kind: ComboKind, predictionIds: number[]) => {
    setError(null);
    startTransition(async () => {
      const res = await saveCombo(predictionIds, kind);
      if (res.ok) setSaved((prev) => new Set([...prev, kind]));
      else setError({ kind, message: res.error ?? '' });
    });
  };
  return { saved, error, pending, save };
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* sin portapapeles */
    }
  };
  return { copied, copy };
}

export function PicksView({ rows, leagues, locale, dateLabel, markedIds }: Props) {
  const t = useTranslations('picks');
  const tc = useTranslations('common');
  const ts = useTranslations('sello');
  const tpa = useTranslations('partido');
  const tv = useTranslations('aiVerdict');
  const aiLabels = { title: tpa('aiReview'), concuerda: tv('concuerda'), cautela: tv('cautela'), discrepa: tv('discrepa'), missing: tpa('aiPlayMissing') };
  const [tab, setTab] = useState<'singles' | 'combos'>('singles');
  const [sello, setSello] = useState<SelloNivel | 'all'>('all');
  const [league, setLeague] = useState<number | 'all'>('all');
  const { copied, copy } = useCopy();
  const comboSaver = useSaveCombo();
  const marked = useMemo(() => new Set(markedIds), [markedIds]);

  const singles = useMemo(
    () => rows.filter((r) => (sello === 'all' || r.sello === sello) && (league === 'all' || r.league_id === league)).sort((a, b) => b.edge - a.edge),
    [rows, sello, league],
  );
  const combos = useMemo(() => buildCombos(rows.filter((r) => !r.started && r.ai?.verdict !== 'discrepa')), [rows]);
  const label = (r: PickRow) => selectionLabel(r.market, r.selection, r.line, { home: r.home, away: r.away, player: r.player_name }, locale);
  const clip = (lines: string[]) => [t('clipboardHeader', { date: dateLabel }), ...lines, '', t('clipboardFooter')].join('\n');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-btn border border-border bg-elevated p-1" role="tablist">
        {(['singles', 'combos'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`h-9 flex-1 rounded-sm text-sm font-medium transition-colors ${tab === k ? 'bg-hover text-text' : 'text-muted hover:text-text'}`}>
            {t(k)}
          </button>
        ))}
      </div>

      {tab === 'singles' && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              <button type="button" className="chip" data-active={sello === 'all'} onClick={() => setSello('all')}>
                {t('all')}
              </button>
              {(['alta', 'media'] as SelloNivel[]).map((s) => (
                <button key={s} type="button" className="chip" data-active={sello === s} onClick={() => setSello(s)}>
                  {ts(s)}
                </button>
              ))}
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              <button type="button" className="chip" data-active={league === 'all'} onClick={() => setLeague('all')}>
                {t('filterLeague')}
              </button>
              {leagues.map((l) => (
                <button key={l.id} type="button" className="chip" data-active={league === l.id} onClick={() => setLeague(l.id)}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          {singles.length === 0 ? (
            <div className="card p-8 text-center text-muted">{t('empty')}</div>
          ) : (
            <StaggerList className="space-y-2">
              {singles.map((r) => {
                const key = `s-${r.id}`;
                const text = clip([`${r.home} vs ${r.away} (${r.league})`, `${label(r)} @ ${odds(r.price)} · ${pct(r.prob)} · ${tc('edge')} ${signedPct(r.edge)}`]);
                return (
                  <StaggerItem key={key} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/partido/${r.fixture_id}`} className="text-xs text-muted hover:text-text">
                          {r.home} vs {r.away} · {r.league}
                        </Link>
                        <p className="mt-1 truncate font-medium">{label(r)}</p>
                        <AiVerdictNote review={r.ai ?? undefined} labels={aiLabels} className="mt-1.5" />
                      </div>
                      <Sello nivel={r.sello} animate={false} />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="flex gap-5">
                        <div>
                          <p className="text-xs text-faint">{tc('probability')}</p>
                          <p className="num text-lg">{pct(r.prob)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-faint">{tc('bestOdds')}</p>
                          <p className="num text-lg">{odds(r.price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-faint">{tc('edge')}</p>
                          <p className="num text-lg text-ventaja">{signedPct(r.edge)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <MarkButton predictionId={r.id} initialMarked={marked.has(r.id)} locked={r.started} />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(key, text)}>
                          {copied === key ? <IconCheck width={16} height={16} /> : <IconCopy width={16} height={16} />}
                          {copied === key ? tc('copied') : t('copyPlay')}
                        </button>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </>
      )}

      {tab === 'combos' && (
        <StaggerList className="grid gap-3 lg:grid-cols-3">
          {(Object.keys(COMBO_RULES) as ComboKind[]).map((kind) => {
            const combo = combos[kind];
            const key = `c-${kind}`;
            const sels = (combo?.selections ?? []) as PickRow[];
            const isSaved = comboSaver.saved.has(kind);
            const text = combo ? clip([`${t(`combo.${kind}`)} · ${t('jointProb')} ${pct(combo.jointProb)} · ${t('totalOdds')} ${combo.totalPrice.toFixed(2)}`, ...sels.map((s) => `• ${s.home} vs ${s.away}: ${label(s)} @ ${odds(s.price)}`)]) : '';
            return (
              <StaggerItem key={kind} className="card flex flex-col p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t(`combo.${kind}`)}</p>
                    <p className="text-xs text-faint">{t(`combo.${kind}Hint`)}</p>
                  </div>
                  {combo && <span className="num text-xs text-muted">{t('selections', { count: combo.selections.length })}</span>}
                </div>
                {!combo ? (
                  <p className="mt-4 text-sm text-muted">{t('combo.unavailable')}</p>
                ) : (
                  <>
                    <ul className="mt-3 flex-1 space-y-2">
                      {sels.map((s) => (
                        <li key={s.id} className="rounded-sm border border-border bg-bg px-3 py-2">
                          <p className="text-xs text-muted">
                            {s.home} vs {s.away}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm">{label(s)}</p>
                            <span className="num text-sm text-muted">{odds(s.price)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
                      <div className="flex gap-5">
                        <div>
                          <p className="text-xs text-faint">{t('jointProb')}</p>
                          <p className="num text-lg text-ventaja">{pct(combo.jointProb)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-faint">{t('totalOdds')}</p>
                          <p className="num text-lg">{combo.totalPrice.toFixed(2)}</p>
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(key, text)}>
                        {copied === key ? <IconCheck width={16} height={16} /> : <IconCopy width={16} height={16} />}
                        {copied === key ? tc('copied') : t('copyPlay')}
                      </button>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm mt-3 w-full" disabled={comboSaver.pending || isSaved} onClick={() => comboSaver.save(kind, sels.map((s) => s.id))}>
                      {isSaved ? <IconCheck width={16} height={16} /> : <IconBookmark width={16} height={16} />}
                      {isSaved ? t('comboSaved') : t('saveCombo')}
                    </button>
                    {comboSaver.error?.kind === kind && (
                      <p role="alert" className="mt-2 text-xs text-fallo">
                        {comboSaver.error.message || tc('errorGeneric')}
                      </p>
                    )}
                  </>
                )}
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}
