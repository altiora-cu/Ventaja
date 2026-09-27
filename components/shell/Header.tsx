import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/ui/Logo';
import { IconUser } from '@/components/ui/Icons';
import type { Viewer } from '@/lib/auth/viewer';

export async function Header({ viewer }: { viewer: Viewer }) {
  const t = await getTranslations('nav');
  const initial = viewer.profile?.email?.[0]?.toUpperCase();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-app items-center justify-between px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-sm" aria-label="Ventaja">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-2">
          {viewer.isAdmin && (
            <Link href="/admin" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              {t('admin')}
            </Link>
          )}
          {viewer.user ? (
            <Link href="/cuenta" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-elevated text-sm font-semibold text-text hover:bg-hover" aria-label={t('cuenta')}>
              {initial ?? <IconUser width={18} height={18} />}
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                {t('login')}
              </Link>
              <Link href="/registro" className="btn btn-primary btn-sm">
                {t('register')}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
