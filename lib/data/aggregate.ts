import type { Fixture, FixtureStats, RecentMatch, SplitStats, TeamStats } from '@/lib/db/types';
import type { LeagueAverages } from '@/lib/engine/types';
import { FINISHED_STATUSES } from './statuses';

/** Funciones puras que calculan team_stats y medias de liga a partir de nuestros fixtures. */

type FinishedFixture = Fixture & { home_goals: number; away_goals: number };

export function finished(fixtures: Fixture[]): FinishedFixture[] {
  return fixtures.filter((f): f is FinishedFixture => FINISHED_STATUSES.has(f.status) && f.home_goals !== null && f.away_goals !== null);
}

function side(stats: FixtureStats | null, key: keyof FixtureStats, home: boolean): number | null {
  const v = stats?.[key] as { home: number; away: number } | undefined;
  if (!v) return null;
  return home ? v.home : v.away;
}

function avg(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function computeTeamStats(fixtures: Fixture[], teamId: number, leagueId: number, season: number, elo = 1500): TeamStats {
  const played = finished(fixtures)
    .filter((f) => f.league_id === leagueId && f.season === season && (f.home_id === teamId || f.away_id === teamId))
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()); // más reciente primero

  const rows = played.map((f) => {
    const isHome = f.home_id === teamId;
    const gf = isHome ? f.home_goals : f.away_goals;
    const gc = isHome ? f.away_goals : f.home_goals;
    const result: 'W' | 'D' | 'L' = gf > gc ? 'W' : gf === gc ? 'D' : 'L';
    return {
      f,
      isHome,
      gf,
      gc,
      xg: side(f.stats, 'xg', isHome),
      xga: side(f.stats, 'xg', !isHome),
      cornersFor: side(f.stats, 'corners', isHome),
      cornersAgainst: side(f.stats, 'corners', !isHome),
      cardsFor: (side(f.stats, 'yellow', isHome) ?? 0) + (side(f.stats, 'red', isHome) ?? 0) || side(f.stats, 'cards', isHome),
      cardsAgainst: (side(f.stats, 'yellow', !isHome) ?? 0) + (side(f.stats, 'red', !isHome) ?? 0) || side(f.stats, 'cards', !isHome),
      shotsFor: side(f.stats, 'shots', isHome),
      shotsAgainst: side(f.stats, 'shots', !isHome),
      sotFor: side(f.stats, 'sot', isHome),
      sotAgainst: side(f.stats, 'sot', !isHome),
      htGf: isHome ? f.ht_home_goals : f.ht_away_goals,
      htGc: isHome ? f.ht_away_goals : f.ht_home_goals,
      result,
    };
  });

  const split = (home: boolean): SplitStats => {
    const rs = rows.filter((r) => r.isHome === home);
    const xgs = rs.map((r) => r.xg);
    const xgas = rs.map((r) => r.xga);
    return {
      played: rs.length,
      gf: rs.reduce((s, r) => s + r.gf, 0),
      gc: rs.reduce((s, r) => s + r.gc, 0),
      xg: xgs.every((x) => x === null) ? null : xgs.reduce<number>((acc, x) => acc + (x ?? 0), 0),
      xga: xgas.every((x) => x === null) ? null : xgas.reduce<number>((acc, x) => acc + (x ?? 0), 0),
      wins: rs.filter((r) => r.result === 'W').length,
      draws: rs.filter((r) => r.result === 'D').length,
      losses: rs.filter((r) => r.result === 'L').length,
    };
  };

  const recent: RecentMatch[] = rows.slice(0, 10).map((r) => ({
    fixture_id: r.f.id,
    date: r.f.kickoff,
    home: r.isHome,
    gf: r.gf,
    gc: r.gc,
    xg: r.xg,
    xga: r.xga,
    result: r.result,
    opponent_id: r.isHome ? r.f.away_id : r.f.home_id,
  }));

  const htRows = rows.filter((r) => r.htGf !== null && r.htGc !== null);
  const halves = htRows.length
    ? {
        ht_gf: htRows.reduce((s, r) => s + (r.htGf ?? 0), 0),
        ht_gc: htRows.reduce((s, r) => s + (r.htGc ?? 0), 0),
        sh_gf: htRows.reduce((s, r) => s + (r.gf - (r.htGf ?? 0)), 0),
        sh_gc: htRows.reduce((s, r) => s + (r.gc - (r.htGc ?? 0)), 0),
      }
    : null;

  const xgAll = rows.map((r) => r.xg);
  const xgaAll = rows.map((r) => r.xga);

  return {
    team_id: teamId,
    league_id: leagueId,
    season,
    played: rows.length,
    wins: rows.filter((r) => r.result === 'W').length,
    draws: rows.filter((r) => r.result === 'D').length,
    losses: rows.filter((r) => r.result === 'L').length,
    gf: rows.reduce((s, r) => s + r.gf, 0),
    gc: rows.reduce((s, r) => s + r.gc, 0),
    xg: xgAll.every((x) => x === null) ? null : xgAll.reduce<number>((acc, x) => acc + (x ?? 0), 0),
    xga: xgaAll.every((x) => x === null) ? null : xgaAll.reduce<number>((acc, x) => acc + (x ?? 0), 0),
    corners_for: avg(rows.map((r) => r.cornersFor)),
    corners_against: avg(rows.map((r) => r.cornersAgainst)),
    cards_for: avg(rows.map((r) => r.cardsFor)),
    cards_against: avg(rows.map((r) => r.cardsAgainst)),
    shots_for: avg(rows.map((r) => r.shotsFor)),
    shots_against: avg(rows.map((r) => r.shotsAgainst)),
    sot_for: avg(rows.map((r) => r.sotFor)),
    sot_against: avg(rows.map((r) => r.sotAgainst)),
    home: split(true),
    away: split(false),
    halves,
    // Forma: últimos 5, más reciente al final (WWDLW)
    form: rows.slice(0, 5).map((r) => r.result).reverse().join(''),
    recent,
    elo,
    updated_at: new Date().toISOString(),
  };
}

export const LEAGUE_DEFAULTS: LeagueAverages = { home_goals: 1.5, away_goals: 1.15, corners: 9.8, cards: 4.4, sot: 8.6, ht_share: 0.44 };

/** Medias de liga desde partidos terminados. Con < 20 partidos, mezcla con valores por defecto. */
export function computeLeagueAverages(fixtures: Fixture[], leagueId: number, season: number): LeagueAverages {
  const fs = finished(fixtures).filter((f) => f.league_id === leagueId && f.season === season);
  const n = fs.length;
  if (!n) return LEAGUE_DEFAULTS;
  const w = Math.min(1, n / 20);
  const mix = (v: number | null, d: number) => (v === null ? d : w * v + (1 - w) * d);

  const homeGoals = fs.reduce((s, f) => s + f.home_goals, 0) / n;
  const awayGoals = fs.reduce((s, f) => s + f.away_goals, 0) / n;
  const corners = avg(fs.map((f) => (f.stats?.corners ? f.stats.corners.home + f.stats.corners.away : null)));
  const cards = avg(
    fs.map((f) => {
      if (f.stats?.yellow || f.stats?.red) return (f.stats.yellow?.home ?? 0) + (f.stats.yellow?.away ?? 0) + (f.stats.red?.home ?? 0) + (f.stats.red?.away ?? 0);
      if (f.stats?.cards) return f.stats.cards.home + f.stats.cards.away;
      return null;
    }),
  );
  const sot = avg(fs.map((f) => (f.stats?.sot ? f.stats.sot.home + f.stats.sot.away : null)));
  const ht = fs.filter((f) => f.ht_home_goals !== null && f.ht_away_goals !== null);
  const totalGoals = ht.reduce((s, f) => s + f.home_goals + f.away_goals, 0);
  const htGoals = ht.reduce((s, f) => s + (f.ht_home_goals ?? 0) + (f.ht_away_goals ?? 0), 0);
  const htShare = totalGoals > 0 ? htGoals / totalGoals : null;

  return {
    home_goals: mix(homeGoals, LEAGUE_DEFAULTS.home_goals),
    away_goals: mix(awayGoals, LEAGUE_DEFAULTS.away_goals),
    corners: mix(corners, LEAGUE_DEFAULTS.corners),
    cards: mix(cards, LEAGUE_DEFAULTS.cards),
    sot: mix(sot, LEAGUE_DEFAULTS.sot),
    ht_share: mix(htShare, LEAGUE_DEFAULTS.ht_share),
  };
}

/** Promedio de tarjetas por árbitro a partir de fixtures con estadísticas. */
export function computeReferees(fixtures: Fixture[]): Array<{ name: string; cards_avg: number; matches: number }> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const f of finished(fixtures)) {
    if (!f.referee || !f.stats) continue;
    const cards = f.stats.yellow || f.stats.red ? (f.stats.yellow?.home ?? 0) + (f.stats.yellow?.away ?? 0) + (f.stats.red?.home ?? 0) + (f.stats.red?.away ?? 0) : f.stats.cards ? f.stats.cards.home + f.stats.cards.away : null;
    if (cards === null) continue;
    const name = f.referee.split(',')[0].trim();
    const e = acc.get(name) ?? { sum: 0, n: 0 };
    e.sum += cards;
    e.n += 1;
    acc.set(name, e);
  }
  return [...acc.entries()].map(([name, { sum, n }]) => ({ name, cards_avg: sum / n, matches: n }));
}
