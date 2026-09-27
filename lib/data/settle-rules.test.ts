import { describe, expect, it } from 'vitest';
import { settleOutcome, unitsFor } from './settle-rules';
import type { Fixture } from '@/lib/db/types';

const f: Fixture = {
  id: 1, league_id: 262, season: 2026, round: null, kickoff: '2026-09-27T00:00:00Z', home_id: 1, away_id: 2, venue: null, city: null, referee: null,
  status: 'FT', home_goals: 2, away_goals: 1, ht_home_goals: 1, ht_away_goals: 1,
  stats: { corners: { home: 6, away: 5 }, yellow: { home: 2, away: 2 }, red: { home: 0, away: 1 }, sot: { home: 5, away: 3 }, players: [{ player_id: 10, team_id: 1, goals: 1, sot: 2, minutes: 90 }, { player_id: 11, team_id: 1, goals: 0, sot: 0, minutes: 0 }] },
  source: null, external_id: null, odds_event_id: null, updated_at: '',
};
const s = (market: string, selection: string, line: number | null = null, player_id: number | null = null) => settleOutcome({ market, selection, line, player_id }, f);

describe('settleOutcome', () => {
  it('1x2 / dc / totals / btts', () => {
    expect(s('1x2', 'home')).toBe('acierto');
    expect(s('1x2', 'draw')).toBe('fallo');
    expect(s('dc', 'X2')).toBe('fallo');
    expect(s('dc', '12')).toBe('acierto');
    expect(s('totals', 'over', 2.5)).toBe('acierto');
    expect(s('totals', 'under', 3.5)).toBe('acierto');
    expect(s('btts', 'yes')).toBe('acierto');
    expect(s('team_totals', 'away_over', 1.5)).toBe('fallo');
  });
  it('hándicap asiático con push', () => {
    expect(s('ah', 'ah_home', -1)).toBe('nulo');
    expect(s('ah', 'ah_home', -0.5)).toBe('acierto');
    expect(s('ah', 'ah_home', -1.5)).toBe('fallo');
    expect(s('ah', 'ah_away', 1.5)).toBe('acierto');
    expect(s('ah', 'ah_away', 1)).toBe('nulo');
  });
  it('mitades', () => {
    expect(s('ht', 'ht_draw')).toBe('acierto');
    expect(s('ht', 'ht_over', 1.5)).toBe('acierto');
    expect(s('2h', '2h_home')).toBe('acierto');
    expect(s('2h', '2h_under', 0.5)).toBe('fallo');
  });
  it('props y jugadores', () => {
    expect(s('corners', 'over', 10.5)).toBe('acierto');
    expect(s('cards', 'under', 5.5)).toBe('acierto'); // 5 tarjetas
    expect(s('sot', 'home_over', 4.5)).toBe('acierto');
    expect(s('player_sot', 'over', 1.5, 10)).toBe('acierto');
    expect(s('player_sot', 'over', 0.5, 11)).toBe('nulo'); // no jugó
    expect(s('scorer', 'scores', null, 10)).toBe('acierto');
    expect(s('scorer', 'scores', null, 99)).toBe('nulo');
  });
  it('sin datos → null', () => {
    expect(settleOutcome({ market: 'corners', selection: 'over', line: 9.5, player_id: null }, { ...f, stats: null })).toBeNull();
    expect(settleOutcome({ market: '1x2', selection: 'home', line: null, player_id: null }, { ...f, home_goals: null })).toBeNull();
  });
  it('unidades', () => {
    expect(unitsFor('acierto', 1.72)).toBeCloseTo(0.72);
    expect(unitsFor('fallo', 1.72)).toBe(-1);
    expect(unitsFor('nulo', 1.72)).toBe(0);
  });
});
