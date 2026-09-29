import Link from 'next/link';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ClosedPicks } from '@/components/historial/ClosedPicks';
import { OpenPicks } from '@/components/historial/OpenPicks';
import { SystemCombos } from '@/components/historial/SystemCombos';
import { StatTiles } from '@/components/ui/StatTiles';
import { getViewer } from '@/lib/auth/viewer';
import { getOpenSystemPicks, getSystemCombos } from '@/lib/data/jugadas';
import { getHistorial } from '@/lib/data/queries';
import { getTimeZone } from '@/lib/tz';
import { pct, signedPct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

const VISTAS = ['cerrados', 'abiertos', 'combinadas'] as const;
type Vista = (typeof VISTAS)[number];
const TAB_KEY: Record<Vista, 'tabClosed' | 'tabOpen' | 'tabCombos'> = { cerrados: 'tabClosed', abiertos: 'tabOpen', combinadas: 'tabCombos' };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('historial');
  return { title: t('title'), description: t('subtitle') };
}

function parseVista(value: string | undefined): Vista {
  return VISTAS.find((v) => v === value) ?? 'cerrados';
}

/** Pantalla pública: es el argumento de venta. Los picks en juego solo se detallan con acceso activo. */
export default async function HistorialPage({ searchParams }: { searchParams: { vista?: string } }) {
  const vista = parseVista(searchParams.vista);
  const [t, locale, data, viewer] = await Promise.all([getTranslations('historial'), getLocale() as Promise<Locale>, getHistorial(), getViewer()]);
  const timeZone = getTimeZone();
  const canSee = viewer.access.canAccess;
  const unlockHref = viewer.user ? '/activar' : '/registro';
  const kpis = [
    { label: t('hitRate'), value: pct(data.hitRate), accent: true },
    { label: t('roi'), value: data.roi === null ? '—' : signedPct(data.roi), hint: t('roiHint') },
    { label: t('streak'), value: data.streak.kind ? (data.streak.kind === 'acierto' ? t('streakHits', { count: data.streak.count }) : t('streakMisses', { count: data.streak.count })) : '—' },
    { label: t('closedPicks'), value: String(data.total) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 max-w-lectura text-sm text-muted">{t('subtitle')}</p>
      </div>

      <StatTiles tiles={kpis} />

      <nav className="no-scrollbar flex gap-2 overflow-x-auto" aria-label={t('tabsLabel')}>
        {VISTAS.map((v) => (
          <Link key={v} href={v === 'cerrados' ? '/historial' : `/historial?vista=${v}`} scroll={false} className="chip" data-active={vista === v} aria-current={vista === v ? 'page' : undefined}>
            {t(TAB_KEY[v])}
            {v === 'abiertos' && data.pending > 0 && <span className="num ml-1.5 text-xs">{data.pending}</span>}
          </Link>
        ))}
      </nav>

      {vista === 'cerrados' && <ClosedPicks data={data} locale={locale} timeZone={timeZone} />}
      {vista === 'abiertos' && <OpenPicks picks={canSee ? await getOpenSystemPicks() : []} pendingCount={data.pending} canSee={canSee} unlockHref={unlockHref} locale={locale} timeZone={timeZone} />}
      {vista === 'combinadas' && <SystemCombos data={await getSystemCombos()} canSee={canSee} locale={locale} />}
    </div>
  );
}
