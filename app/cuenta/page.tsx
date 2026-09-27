import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/cuenta/LocaleSwitcher';
import { TimezoneDetect } from '@/components/cuenta/TimezoneDetect';
import { PasswordForm } from '@/components/cuenta/PasswordForm';
import { IconWhatsApp } from '@/components/ui/Icons';
import { signOut } from '@/app/actions/auth';
import { getViewer } from '@/lib/auth/viewer';
import { getTimeZone } from '@/lib/tz';
import { fmtDate, whatsappLink } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function CuentaPage() {
  const [t, tc, locale, viewer] = await Promise.all([getTranslations('cuenta'), getTranslations('common'), getLocale() as Promise<Locale>, getViewer()]);
  const { access, profile, user } = viewer;
  const email = profile?.email ?? user?.email ?? '';
  const timeZone = getTimeZone();

  let statusText = '';
  switch (access.status) {
    case 'admin':
      statusText = t('admin');
      break;
    case 'trial':
      statusText = access.daysLeft && access.daysLeft > 0 ? t('trial', { days: tc('days', { count: access.daysLeft }) }) : t('trialEndsToday');
      break;
    case 'activa':
      statusText = t('active', { date: fmtDate(access.expiresAt!, locale, { day: '2-digit', month: '2-digit', year: 'numeric' }, timeZone) });
      break;
    case 'suspendida':
      statusText = t('suspended');
      break;
    default:
      statusText = t('expired');
  }
  const statusColor = access.status === 'vencida' || access.status === 'suspendida' ? 'text-muted' : access.needsReminder ? 'text-[var(--warning)]' : 'text-ventaja';

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>

      <section className="card p-4">
        <p className="text-xs text-muted">{t('status')}</p>
        <p className={`mt-1 text-lg font-medium ${statusColor}`}>{statusText}</p>
        <p className="mt-3 text-xs text-muted">{t('email')}</p>
        <p className="text-sm">{email}</p>
        {profile?.created_at && (
          <>
            <p className="mt-3 text-xs text-muted">{t('memberSince')}</p>
            <p className="num text-sm">{fmtDate(profile.created_at, locale, undefined, timeZone)}</p>
          </>
        )}
        {access.status !== 'admin' && (
          <a href={whatsappLink(email)} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4 w-full">
            <IconWhatsApp width={18} height={18} />
            {t('activate')}
          </a>
        )}
        {viewer.isAdmin && (
          <Link href="/admin" className="btn btn-secondary mt-4 w-full">
            {t('adminPanel')}
          </Link>
        )}
      </section>

      <section className="card space-y-4 p-4">
        <div>
          <p className="mb-2 text-xs text-muted">{t('language')}</p>
          <LocaleSwitcher />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">{t('timezone')}</p>
            <p className="text-xs text-faint">{t('timezoneDetected')}</p>
          </div>
          <TimezoneDetect current={timeZone} />
        </div>
      </section>

      <section className="card p-4">
        <p className="mb-2 text-xs text-muted">{t('changePassword')}</p>
        <PasswordForm />
      </section>

      <form action={signOut}>
        <button type="submit" className="btn btn-ghost w-full">
          {t('logout')}
        </button>
      </form>
    </div>
  );
}
