import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AdminTools } from '@/components/admin/AdminTools';
import { UsersTable } from '@/components/admin/UsersTable';
import { getViewer } from '@/lib/auth/viewer';
import { getProfiles, getStaleFixtures } from '@/lib/data/queries';
import { getLocale } from 'next-intl/server';
import { fmtDate } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [t, viewer] = await Promise.all([getTranslations('admin'), getViewer()]);
  if (!viewer.isAdmin) redirect('/');
  const [profiles, stale, locale] = await Promise.all([getProfiles(), getStaleFixtures(), getLocale() as Promise<Locale>]);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      {stale.length > 0 && (
        <section className="rounded-md border border-[rgba(245,184,65,0.35)] bg-[var(--warning-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--warning)]">{t('staleResults', { count: stale.length })}</p>
          <p className="mt-1 text-xs text-muted">{t('staleResultsHint')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {stale.slice(0, 10).map((f) => (
              <li key={f.id} className="flex flex-wrap gap-x-3">
                <span className="num text-muted">#{f.id}</span>
                <span className="text-muted">{fmtDate(f.kickoff, locale)}</span>
                <span>
                  {f.home.name} vs {f.away.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AdminTools />
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('users')}</h2>
        <UsersTable profiles={profiles} />
      </section>
    </div>
  );
}
