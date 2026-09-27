'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { adminUpdateUser, type AdminAction } from '@/app/actions/admin';
import type { Profile } from '@/lib/db/types';
import { resolveStatus } from '@/lib/auth/status';
import { fmtDate } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export function UsersTable({ profiles }: { profiles: Profile[] }) {
  const t = useTranslations('admin');
  const tcu = useTranslations('cuenta');
  const locale = useLocale() as Locale;
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const now = new Date();
    return profiles
      .filter((p) => p.email.toLowerCase().includes(q.toLowerCase()))
      .map((p) => ({ p, access: resolveStatus(p, now) }));
  }, [profiles, q]);

  const counts = useMemo(() => {
    const c = { trial: 0, activa: 0, vencida: 0, suspendida: 0 };
    for (const { access } of rows) if (access.status !== 'admin') c[access.status]++;
    return c;
  }, [rows]);

  const run = (id: string, action: AdminAction) => {
    setBusy(id);
    setErr(null);
    start(async () => {
      const r = await adminUpdateUser(id, action);
      if (!r.ok) setErr(r.error ?? 'error');
      setBusy(null);
    });
  };

  const statusLabel = (s: string) => (s === 'admin' ? 'admin' : s === 'trial' ? t('inTrial') : s === 'activa' ? tcu('active', { date: '' }).replace(/\s+$/, '') : s === 'vencida' ? tcu('expired') : tcu('suspended'));
  const d = (iso: string | null) => (iso ? fmtDate(iso, locale) : t('never'));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t('inTrial'), counts.trial],
          [t('active'), counts.activa],
          [t('expired'), counts.vencida],
          [t('suspended'), counts.suspendida],
        ].map(([label, n]) => (
          <div key={String(label)} className="card p-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="num text-xl">{n}</p>
          </div>
        ))}
      </div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="input" aria-label={t('search')} />
      {err && <p className="text-sm text-fallo">{err}</p>}
      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th>{t('email')}</th>
              <th>{t('registered')}</th>
              <th>{t('status')}</th>
              <th>{t('trialEnds')}</th>
              <th>{t('paidUntil')}</th>
              <th>{t('lastSeen')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted">
                  {t('noUsers')}
                </td>
              </tr>
            )}
            {rows.map(({ p, access }) => (
              <tr key={p.id} className={busy === p.id ? 'opacity-60' : ''}>
                <td>
                  <span className="font-medium">{p.email}</span>
                  {p.role === 'admin' && <span className="ml-2 rounded-sm bg-[var(--ventaja-bg)] px-1.5 py-0.5 text-xs text-ventaja">admin</span>}
                </td>
                <td className="num text-muted">{d(p.created_at)}</td>
                <td>
                  <span className={access.status === 'activa' || access.status === 'admin' ? 'text-ventaja' : access.status === 'trial' ? 'text-[var(--warning)]' : 'text-muted'}>{statusLabel(access.status)}</span>
                </td>
                <td className="num text-muted">{d(p.trial_ends_at)}</td>
                <td className="num text-muted">{d(p.paid_until)}</td>
                <td className="num text-muted">{d(p.last_seen_at)}</td>
                <td>
                  {p.role !== 'admin' && (
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(p.id, 'activate30')}>
                        {t('activate30')}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(p.id, 'activate90')}>
                        {t('activate90')}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(p.id, 'extend7')}>
                        {t('extend7')}
                      </button>
                      {access.status === 'suspendida' ? (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(p.id, 'unsuspend')}>
                          {t('unsuspend')}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm text-muted" disabled={pending} onClick={() => run(p.id, 'suspend')}>
                          {t('suspend')}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
