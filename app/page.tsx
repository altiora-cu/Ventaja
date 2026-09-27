import { getLocale, getTranslations } from 'next-intl/server';
import { DateChips, type DateChip } from '@/components/jornada/DateChips';
import { LeagueChips } from '@/components/jornada/LeagueChips';
import { FixtureCard, type LockMode } from '@/components/jornada/FixtureCard';
import { choosePickOfDay, PickDelDia } from '@/components/jornada/PickDelDia';
import { StaggerList } from '@/components/ui/Motion';
import { getViewer } from '@/lib/auth/viewer';
import { getFixturesForDate, getLeagues } from '@/lib/data/queries';
import { getTimeZone } from '@/lib/tz';
import { addDays, fmtDateShort, isDateKey, toDateKey } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function JornadaPage({ searchParams }: { searchParams: { fecha?: string; liga?: string } }) {
  const [t, locale, viewer, leagues] = await Promise.all([getTranslations('jornada'), getLocale() as Promise<Locale>, getViewer(), getLeagues()]);
  const timeZone = getTimeZone();
  const today = toDateKey(new Date(), timeZone);
  const date = searchParams.fecha && isDateKey(searchParams.fecha) ? searchParams.fecha : today;
  const leagueId = searchParams.liga ? Number(searchParams.liga) || undefined : undefined;

  const fixtures = await getFixturesForDate(date, leagueId, timeZone);
  const lock: LockMode = viewer.access.canAccess ? 'none' : viewer.user ? 'activar' : 'login';

  const base = new Date(`${today}T12:00:00Z`);
  const chips: DateChip[] = Array.from({ length: 15 }, (_, i) => i - 7).map((offset) => {
    const d = addDays(base, offset);
    return { key: toDateKey(d, 'UTC'), label: fmtDateShort(d, locale, 'UTC'), offset };
  });

  const pick = date === today ? choosePickOfDay(fixtures) : null;
  const byLeague = new Map<number, typeof fixtures>();
  for (const f of fixtures) byLeague.set(f.league_id, [...(byLeague.get(f.league_id) ?? []), f]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>
      <div className="space-y-3">
        <DateChips chips={chips} active={date} league={searchParams.liga} locale={locale} />
        <LeagueChips leagues={leagues} active={leagueId} date={date !== today ? date : undefined} />
      </div>

      {date === today && <PickDelDia fixture={pick} lock={lock} timeZone={timeZone} />}

      {fixtures.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">{t('noFixtures')}</p>
          <p className="mt-1 text-sm text-faint">{t('noFixturesHint')}</p>
        </div>
      ) : (
        [...byLeague.entries()].map(([lid, list]) => (
          <section key={lid} className="space-y-3">
            <h2 className="flex items-center justify-between text-sm font-medium text-muted">
              <span>{list[0].league.name}</span>
              <span className="num text-xs text-faint">{t('matchesCount', { count: list.length })}</span>
            </h2>
            <StaggerList className="grid gap-3 lg:grid-cols-2">
              {list.map((f) => (
                <FixtureCard key={f.id} fixture={f} lock={lock} timeZone={timeZone} />
              ))}
            </StaggerList>
          </section>
        ))
      )}
    </div>
  );
}
