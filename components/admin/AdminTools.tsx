'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { adminIngestNow, adminRecalcToday, adminSetScore } from '@/app/actions/admin';

export function AdminTools() {
  const t = useTranslations('admin');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<{ ok: boolean; count?: number; error?: string }>) =>
    start(async () => {
      setMsg(t('recalcRunning'));
      const r = await fn();
      setMsg(r.ok ? t('recalcDone', { count: r.count ?? 0 }) : t('recalcError', { error: r.error ?? '' }));
    });
  const [score, setScore] = useState({ id: '', h: '', a: '' });
  return (
    <div className="space-y-3">
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => go(adminRecalcToday)}>
        {t('recalc')}
      </button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => go(adminIngestNow)}>
        {t('ingest')}
      </button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
    <form
      className="card flex flex-wrap items-end gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminSetScore(Number(score.id), Number(score.h), Number(score.a));
          setMsg(r.ok ? t('scoreSaved') : t('recalcError', { error: r.error ?? '' }));
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('fixtureId')}
        <input className="input w-40" required inputMode="numeric" value={score.id} onChange={(e) => setScore({ ...score, id: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('homeGoals')}
        <input className="input w-24" required inputMode="numeric" value={score.h} onChange={(e) => setScore({ ...score, h: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('awayGoals')}
        <input className="input w-24" required inputMode="numeric" value={score.a} onChange={(e) => setScore({ ...score, a: e.target.value })} />
      </label>
      <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
        {t('setScore')}
      </button>
    </form>
    </div>
  );
}
