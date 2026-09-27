import { getTranslations } from 'next-intl/server';
import { Search } from '@/components/buscar/Search';
import { getViewer } from '@/lib/auth/viewer';
import { getTimeZone } from '@/lib/tz';

export const dynamic = 'force-dynamic';

export default async function BuscarPage() {
  const [t, viewer] = await Promise.all([getTranslations('buscar'), getViewer()]);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Search locked={!viewer.access.canAccess} timeZone={getTimeZone()} />
    </div>
  );
}
