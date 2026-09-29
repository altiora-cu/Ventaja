'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { IconBookmark, IconCalendar, IconHistory, IconSearch, IconTarget, IconUser } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/', key: 'jornada', Icon: IconCalendar },
  { href: '/picks', key: 'picks', Icon: IconTarget },
  { href: '/mis-jugadas', key: 'misJugadas', Icon: IconBookmark },
  { href: '/buscar', key: 'buscar', Icon: IconSearch },
  { href: '/historial', key: 'historial', Icon: IconHistory },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/partido');
  return pathname.startsWith(href);
}

/** Móvil: barra inferior fija con 5 ítems. Desktop: sidebar izquierda 240px. */
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label={t('jornada')}>
      <ul className="mx-auto grid h-[64px] max-w-app grid-cols-5">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} className={cn('flex h-full flex-col items-center justify-center gap-1 px-0.5 text-center text-[11px] font-medium leading-none', active ? 'text-ventaja' : 'text-muted hover:text-text')} aria-current={active ? 'page' : undefined}>
                <Icon width={22} height={22} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ showAdmin, loggedIn }: { showAdmin: boolean; loggedIn: boolean }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  return (
    <aside className="hidden lg:block w-[240px] shrink-0">
      <nav className="sticky top-[72px] flex flex-col gap-1" aria-label={tc('menu')}>
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={cn('flex h-11 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors', active ? 'bg-[var(--ventaja-bg)] text-ventaja' : 'text-muted hover:bg-hover hover:text-text')} aria-current={active ? 'page' : undefined}>
              <Icon width={20} height={20} />
              {t(key)}
            </Link>
          );
        })}
        {loggedIn && (
          <Link href="/cuenta" className={cn('flex h-11 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors', pathname.startsWith('/cuenta') ? 'bg-[var(--ventaja-bg)] text-ventaja' : 'text-muted hover:bg-hover hover:text-text')}>
            <IconUser width={20} height={20} />
            {t('cuenta')}
          </Link>
        )}
        {showAdmin && (
          <Link href="/admin" className={cn('mt-4 flex h-11 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors', pathname.startsWith('/admin') ? 'bg-[var(--ventaja-bg)] text-ventaja' : 'text-muted hover:bg-hover hover:text-text')}>
            {t('admin')}
          </Link>
        )}
      </nav>
    </aside>
  );
}
