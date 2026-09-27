import { describe, expect, it } from 'vitest';
import { computeLeagueAverages, computeReferees, computeTeamStats } from './aggregate';
import type { Fixture } from '@/lib/db/types';

function fx(id: number, kickoff: string, home_id: number, away_id: number, hg: number, ag: number, extra: Partial<Fixture> = {}): Fixture {
  return {
    id, league_id: 262, season: 2026, round: null, kickoff, home_id, away_id, venue: null, city: null, referee: 'R. Pérez',
    status: 'FT', home_goals: hg, away_goals: ag, ht_home_goals: Math.min(hg, 1), ht_away_goals: 0,
    stats: { corners: { home: 6, away: 4 }, yellow: { home: 2, away: 3 }, red: { home: 0, away: 0 }, shots: { home: 12, away: 8 }, sot: { home: 5, away: 3 }, xg: { home: 1.6, away: 0.9 } },
    updated_at: kickoff, ...extra,
  };
}

const fixtures: Fixture[] = [
  fx(1, '2026-08-01T00:00:00Z', 1, 2, 2, 0),
  fx(2, '2026-08-08T00:00:00Z', 2, 1, 1, 1),
  fx(3, '2026-08-15T00:00:00Z', 1, 3, 0, 1),
  fx(4, '2026-08-22T00:00:00Z', 3, 1, 2, 2),
  fx(5, '2026-08-29T00:00:00Z', 1, 2, 3, 1),
  fx(6, '2026-09-05T00:00:00Z', 2, 3, 1, 0, { status: 'NS', home_goals: null, away_goals: null }),
];

describe('aggregate', () => {
  it('team_stats: forma, desglose local/visita y recientes en orden', () => {
    const ts = computeTeamStats(fixtures, 1, 262, 2026);
    expect(ts.played).toBe(5);
    expect(ts.form).toBe('WDLDW');
    expect(ts.home?.played).toBe(3);
    expect(ts.home?.gf).toBe(5);
    expect(ts.away?.gf).toBe(3);
    expect(ts.recent?.[0].fixture_id).toBe(5);
    expect(ts.recent?.[0].result).toBe('W');
    expect(ts.corners_for).toBeCloseTo((6 + 4 + 6 + 4 + 6) / 5, 6);
    expect(ts.xg).toBeCloseTo(1.6 * 3 + 0.9 * 2, 6);
    expect(ts.halves?.ht_gf).toBeGreaterThan(0);
  });

  it('medias de liga mezclan con defaults con poca muestra', () => {
    const la = computeLeagueAverages(fixtures, 262, 2026);
    expect(la.home_goals).toBeGreaterThan(1.3);
    expect(la.home_goals).toBeLessThan(1.7);
    expect(la.corners).toBeGreaterThan(9.5);
    expect(la.ht_share).toBeGreaterThan(0.3);
    expect(la.ht_share).toBeLessThan(0.6);
  });

  it('árbitros: promedio de tarjetas', () => {
    const refs = computeReferees(fixtures);
    expect(refs[0].name).toBe('R. Pérez');
    expect(refs[0].cards_avg).toBe(5);
    expect(refs[0].matches).toBe(5);
  });
});
