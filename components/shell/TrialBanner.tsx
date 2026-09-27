import { getTranslations } from 'next-intl/server';
import { whatsappLink } from '@/lib/utils';

/** Banner fijo ámbar bajo el header durante los últimos 5 días. No se puede cerrar. */
export async function TrialBanner({ days, email }: { days: number; email: string | null }) {
  const t = await getTranslations('recordatorio');
  const tc = await getTranslations('common');
  const text = days <= 0 ? t('bannerToday') : t('banner', { days: tc('days', { count: days }) });
  return (
    <div className="sticky top-14 z-20 border-b border-[rgba(245,184,65,0.35)] bg-[var(--warning-bg)]" role="status">
      <div className="mx-auto flex max-w-app items-center justify-between gap-3 px-4 py-2 lg:px-8">
        <p className="text-sm text-[var(--warning)]">{text}</p>
        <a href={whatsappLink(email)} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-sm border border-[rgba(245,184,65,0.5)] px-2.5 py-1 text-xs font-semibold text-[var(--warning)] hover:bg-[rgba(245,184,65,0.15)]">
          {t('bannerCta')}
        </a>
      </div>
    </div>
  );
}
