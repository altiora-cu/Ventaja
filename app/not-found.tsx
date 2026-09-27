import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="num text-3xl text-faint">404</p>
      <h1 className="mt-3 text-xl font-semibold">{t('title')}</h1>
      <p className="mt-2 text-muted">{t('body')}</p>
      <Link href="/" className="btn btn-primary mt-6">
        {t('cta')}
      </Link>
    </div>
  );
}
