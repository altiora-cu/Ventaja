import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function Footer() {
  const t = await getTranslations('common');
  return (
    <footer className="mt-12 border-t border-border pb-nav">
      <div className="mx-auto max-w-app px-4 py-6 lg:px-8">
        <p className="text-xs leading-relaxed text-faint max-w-[70ch]">{t('disclaimer')}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <Link href="/legal" className="hover:text-text">
            {t('legal')}
          </Link>
          <Link href="/historial" className="hover:text-text">
            {t('appName')} · {new Date().getFullYear()}
          </Link>
        </div>
      </div>
    </footer>
  );
}
