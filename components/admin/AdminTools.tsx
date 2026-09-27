'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { adminIngestNow, adminRecalcToday } from '@/app/actions/admin';

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
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => go(adminRecalcToday)}>
        {t('recalc')}
      </button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => go(adminIngestNow)}>
        {t('ingest')}
      </button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
