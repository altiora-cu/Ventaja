import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PicksView, type PickRow } from '@/components/picks/PicksView';
import { getViewer } from '@/lib/auth/viewer';
import { getMarkedPredictionIds } from '@/lib/data/jugadas';
import { getPickCandidates } from '@/lib/data/queries';
import { getTimeZone } from '@/lib/tz';
import { addDays, fmtDate, isDateKey, toDateKey } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

/** Días que se ofrecen en el selector: hoy y los tres siguientes (las predicciones se calculan a 3 días). */
const DAYS_AHEAD = 4;

export default async function PicksPage({ searchParams }: { searchParams: { fecha?: string } }) {
  const [t, locale] = await Promise.all([getTranslations('picks'), getLocale() as Promise<Locale>]);
  const timeZone = getTimeZone();
  const now = new Date();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => toDateKey(addDays(now, i), timeZone));
  const explicit = searchParams.fecha && isDateKey(searchParams.fecha) ? searchParams.fecha : null;

  // Picks con cuota de cada día del selector (consultas cacheadas por request).
  const perDay = await Promise.all(days.map(async (d) => (await getPickCandidates(d, timeZone)).filter((c) => c.best_price)));
  const counts = perDay.map((list) => list.length);

  // Sin fecha pedida y hoy vacío: se abre el primer día con picks, para no recibir al usuario con una pantalla vacía.
  let date = explicit ?? days[0];
  let jumped = false;
  if (!explicit && counts[0] === 0) {
    const next = counts.findIndex((n) => n > 0);
    if (next > 0) {
      date = days[next];
      jumped = true;
    }
  }
  const dayIndex = days.indexOf(date);
  const [cands, viewer] = await Promise.all([dayIndex >= 0 ? perDay[dayIndex] : getPickCandidates(date, timeZone).then((l) => l.filter((c) => c.best_price)), getViewer()]);
  const markedIds = await getMarkedPredictionIds(viewer.user?.id ?? null, cands);
  const nowMs = now.getTime();
  const rows: PickRow[] = cands.map((c) => ({
    id: c.id,
    fixture_id: c.fixture_id,
    league_id: c.fixture.league_id,
    league: c.fixture.league.name,
    home: c.fixture.home.name,
    away: c.fixture.away.name,
    kickoff: c.fixture.kickoff,
    started: new Date(c.fixture.kickoff).getTime() <= nowMs,
    market: c.market,
    selection: c.selection,
    line: c.line === null ? null : Number(c.line),
    player_name: c.player_name,
    prob: Number(c.prob),
    price: Number(c.best_price),
    edge: Number(c.edge),
    sello: c.ai?.sello_final ?? c.sello,
    ai: c.ai,
  }));
  const leagues = [...new Map(rows.map((r) => [r.league_id, { id: r.league_id, name: r.league }])).values()];
  const dayLabel = (d: string, i: number, long = false) =>
    i === 0 ? t('today') : i === 1 ? t('tomorrow') : fmtDate(`${d}T12:00:00Z`, locale, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric' }, 'UTC');
  const noneAhead = counts.every((n) => n === 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>

      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label={t('title')}>
        {days.map((d, i) => (
          <Link key={d} href={`/picks?fecha=${d}`} scroll={false} className="chip shrink-0" data-active={d === date} aria-current={d === date ? 'page' : undefined}>
            <span className="capitalize">{dayLabel(d, i)}</span>
            <span className={`num ml-1.5 text-xs ${counts[i] > 0 ? '' : 'text-faint'}`}>{counts[i]}</span>
          </Link>
        ))}
      </nav>

      {jumped && <p className="rounded-md border border-border bg-elevated px-4 py-3 text-sm text-muted">{t('jumped', { day: dayLabel(date, dayIndex, true).toLowerCase() })}</p>}

      {noneAhead && dayIndex >= 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted">{t('emptyAll')}</p>
          <Link href="/" className="btn btn-secondary mt-4">
            {t('goJornada')}
          </Link>
        </div>
      ) : (
        <PicksView key={date} rows={rows} leagues={leagues} locale={locale} markedIds={markedIds} timeZone={timeZone} dateLabel={fmtDate(`${date}T12:00:00Z`, locale, { day: 'numeric', month: 'short' }, 'UTC')} />
      )}
    </div>
  );
}
