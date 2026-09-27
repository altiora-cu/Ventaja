import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { League } from '@/lib/db/types';

export async function LeagueChips({ leagues, active, date }: { leagues: League[]; active?: number; date?: string }) {
  const t = await getTranslations('jornada');
  const href = (leagueId?: number) => {
    const p = new URLSearchParams();
    if (date) p.set('fecha', date);
    if (leagueId) p.set('liga', String(leagueId));
    const qs = p.toString();
    return qs ? `/?${qs}` : '/';
  };
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
      <Link href={href()} className="chip" data-active={!active} scroll={false}>
        {t('allLeagues')}
      </Link>
      {leagues.map((l) => (
        <Link key={l.id} href={href(l.id)} className="chip" data-active={active === l.id} scroll={false}>
          {l.logo && <Image src={l.logo} alt="" width={16} height={16} className="h-4 w-4 object-contain" />}
          {l.name}
        </Link>
      ))}
    </div>
  );
}
