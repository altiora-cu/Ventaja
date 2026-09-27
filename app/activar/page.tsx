import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { IconBook, IconChart, IconShield, IconWhatsApp } from '@/components/ui/Icons';
import { FadeIn } from '@/components/ui/Motion';
import { getViewer } from '@/lib/auth/viewer';
import { getFixturesForDate } from '@/lib/data/queries';
import { getTimeZone } from '@/lib/tz';
import { toDateKey, whatsappLink } from '@/lib/utils';
import { TeamLogo } from '@/components/ui/TeamLogo';

export const dynamic = 'force-dynamic';

/** Paywall: detrás, la Jornada de hoy con blur(12px). Delante, panel con un único CTA. */
export default async function ActivarPage() {
  const [t, tc, viewer] = await Promise.all([getTranslations('activar'), getTranslations('common'), getViewer()]);
  if (!viewer.user) redirect('/login?next=/');
  if (viewer.access.canAccess) redirect('/');
  const timeZone = getTimeZone();
  const fixtures = await getFixturesForDate(toDateKey(new Date(), timeZone), undefined, timeZone);
  const suspended = viewer.access.status === 'suspendida';
  const email = viewer.profile?.email ?? viewer.user.email ?? '';
  const benefits = [
    { Icon: IconBook, text: t('benefit1') },
    { Icon: IconShield, text: t('benefit2') },
    { Icon: IconChart, text: t('benefit3') },
  ];

  return (
    <div className="relative min-h-[70dvh]">
      {/* Jornada borrosa detrás */}
      <div className="pointer-events-none select-none blur-[12px] transition-[filter] duration-[400ms] ease-out" aria-hidden="true">
        <div className="grid gap-3 lg:grid-cols-2">
          {(fixtures.length ? fixtures : Array.from({ length: 6 }, (_, i) => null as (typeof fixtures)[number] | null)).slice(0, 6).map((f, i) => (
            <div key={f?.id ?? i} className="card p-4">
              {f ? (
                <>
                  <div className="flex items-center gap-3">
                    <TeamLogo src={f.home.logo} name={f.home.name} size={32} />
                    <span className="text-lg">{f.home.name}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <TeamLogo src={f.away.logo} name={f.away.name} size={32} />
                    <span className="text-lg">{f.away.name}</span>
                  </div>
                </>
              ) : (
                <div className="h-24" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex items-start justify-center pt-6 sm:items-center sm:pt-0">
        <FadeIn className="w-full max-w-md">
          <div className="rounded-lg border border-border-strong bg-elevated p-6 shadow-modal sm:p-8">
            <h1 className="text-2xl font-semibold">{suspended ? t('suspendedTitle') : t('title')}</h1>
            <p className="mt-2 text-muted">{suspended ? t('suspendedSubtitle') : t('subtitle')}</p>
            <ul className="mt-6 space-y-3">
              {benefits.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm">
                  <Icon width={18} height={18} className="mt-0.5 shrink-0 text-ventaja" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <a href={whatsappLink(email)} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6 w-full">
              <IconWhatsApp width={18} height={18} />
              {tc('whatsappCta')}
            </a>
            <p className="mt-3 text-center text-xs text-faint">{t('note')}</p>
            <p className="mt-4 text-center text-xs text-faint">{tc('disclaimer')}</p>
            <Link href="/historial" className="btn btn-ghost mt-2 w-full">
              {t('backHome')}
            </Link>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
