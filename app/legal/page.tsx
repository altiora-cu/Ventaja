import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return { title: t('title') };
}

export default async function LegalPage() {
  const t = await getTranslations('legal');
  const sections = ['age', 'responsible', 'data', 'sources', 'subscription'] as const;
  return (
    <article className="mx-auto max-w-lectura space-y-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-muted">{t('intro')}</p>
      {sections.map((s) => (
        <section key={s}>
          <h2 className="text-lg font-medium">{t(`${s}Title`)}</h2>
          <p className="mt-1 text-muted">{t(s)}</p>
        </section>
      ))}
    </article>
  );
}
