import { getTranslations } from 'next-intl/server';
import { FormaChips } from '@/components/ui/FormaChips';
import type { Team, TeamStats } from '@/lib/db/types';

function per(n: number | null | undefined, played: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !played) return '—';
  return (n / played).toFixed(d);
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 text-sm">
      <span className="num text-right">{a}</span>
      <span className="text-center text-xs text-faint">{label}</span>
      <span className="num">{b}</span>
    </div>
  );
}

export async function FormaBlock({ home, away, hs, as }: { home: Team; away: Team; hs: TeamStats | null; as: TeamStats | null }) {
  const t = await getTranslations('partido');
  const last10 = (s: TeamStats | null) => (s?.recent ?? []).slice(0, 10).map((r) => r.result).reverse().join('');
  return (
    <section className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('formBlock')}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm font-medium">
        <span className="truncate text-right">{home.name}</span>
        <span />
        <span className="truncate">{away.name}</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5">
        <span className="flex justify-end">
          <FormaChips form={hs?.form} />
        </span>
        <span className="text-center text-xs text-faint">{t('last5')}</span>
        <FormaChips form={as?.form} />
      </div>
      <Row label={t('last10')} a={last10(hs) || '—'} b={last10(as) || '—'} />
      <Row label={`${t('gf')} / ${t('gc')}`} a={hs ? `${per(hs.gf, hs.played)} / ${per(hs.gc, hs.played)}` : '—'} b={as ? `${per(as.gf, as.played)} / ${per(as.gc, as.played)}` : '—'} />
      <Row label={`${t('xg')} / ${t('xga')}`} a={hs ? `${per(hs.xg, hs.played)} / ${per(hs.xga, hs.played)}` : '—'} b={as ? `${per(as.xg, as.played)} / ${per(as.xga, as.played)}` : '—'} />
      <Row
        label={t('homeAway')}
        a={hs?.home ? `${t('atHome')} ${hs.home.wins ?? 0}-${hs.home.draws ?? 0}-${hs.home.losses ?? 0}` : '—'}
        b={as?.away ? `${t('atAway')} ${as.away.wins ?? 0}-${as.away.draws ?? 0}-${as.away.losses ?? 0}` : '—'}
      />
    </section>
  );
}
