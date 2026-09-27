import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AdminTools } from '@/components/admin/AdminTools';
import { UsersTable } from '@/components/admin/UsersTable';
import { getViewer } from '@/lib/auth/viewer';
import { getProfiles } from '@/lib/data/queries';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [t, viewer] = await Promise.all([getTranslations('admin'), getViewer()]);
  if (!viewer.isAdmin) redirect('/');
  const profiles = await getProfiles();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <AdminTools />
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('users')}</h2>
        <UsersTable profiles={profiles} />
      </section>
    </div>
  );
}
