import { getLocale, getTranslations } from 'next-intl/server';
import { PicksView, type PickRow } from '@/components/picks/PicksView';
import { getPickCandidates } from '@/lib/data/queries';
import { getTimeZone } from '@/lib/tz';
import { fmtDate, isDateKey, toDateKey } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function PicksPage({ searchParams }: { searchParams: { fecha?: string } }) {
  const [t, locale] = await Promise.all([getTranslations('picks'), getLocale() as Promise<Locale>]);
  const timeZone = getTimeZone();
  const date = searchParams.fecha && isDateKey(searchParams.fecha) ? searchParams.fecha : toDateKey(new Date(), timeZone);
  const cands = await getPickCandidates(date, timeZone);
  const rows: PickRow[] = cands
    .filter((c) => c.best_price)
    .map((c) => ({
      id: c.id,
      fixture_id: c.fixture_id,
      league_id: c.fixture.league_id,
      league: c.fixture.league.name,
      home: c.fixture.home.name,
      away: c.fixture.away.name,
      kickoff: c.fixture.kickoff,
      market: c.market,
      selection: c.selection,
      line: c.line === null ? null : Number(c.line),
      player_name: c.player_name,
      prob: Number(c.prob),
      price: Number(c.best_price),
      edge: Number(c.edge),
      sello: c.sello,
    }));
  const leagues = [...new Map(rows.map((r) => [r.league_id, { id: r.league_id, name: r.league }])).values()];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>
      <PicksView rows={rows} leagues={leagues} locale={locale} dateLabel={fmtDate(`${date}T12:00:00Z`, locale, { day: 'numeric', month: 'short' }, 'UTC')} />
    </div>
  );
}
