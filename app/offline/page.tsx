import { getTranslations } from 'next-intl/server';

export default async function OfflinePage() {
  const t = await getTranslations('common');
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">{t('appName')}</h1>
      <p className="mt-2 text-muted">{t('errorGeneric')}</p>
    </div>
  );
}
