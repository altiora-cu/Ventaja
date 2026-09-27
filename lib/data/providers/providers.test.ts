import { describe, expect, it } from 'vitest';
import { eventToFixture, scoreToFixture } from './odds-events';
import { fdMatchToFixture } from './football-data-normalize';

describe('The Odds API → fixtures', () => {
  it('evento próximo', () => {
    const f = eventToFixture({ id: 'abc123', sport_key: 'soccer_epl', commence_time: '2026-09-28T15:00:00Z', home_team: 'Arsenal', away_team: 'Liverpool' });
    expect(f).toMatchObject({ source: 'odds_api', external_id: 'abc123', odds_event_id: 'abc123', status: 'NS', home_name: 'Arsenal', away_name: 'Liverpool' });
  });
  it('resultado terminado y no terminado', () => {
    const done = scoreToFixture({ id: 'e1', sport_key: 'soccer_mexico_ligamx', commence_time: '2026-09-26T01:00:00Z', home_team: 'Tigres UANL', away_team: 'Pumas UNAM', completed: true, scores: [{ name: 'Tigres UANL', score: '3' }, { name: 'Pumas UNAM', score: '0' }], last_update: '2026-09-26T03:00:00Z' });
    expect(done).toMatchObject({ status: 'FT', home_goals: 3, away_goals: 0 });
    const pending = scoreToFixture({ id: 'e2', sport_key: 'soccer_mexico_ligamx', commence_time: '2099-01-01T01:00:00Z', home_team: 'A', away_team: 'B', completed: false, scores: null, last_update: null });
    expect(pending?.status).toBe('NS');
    const broken = scoreToFixture({ id: 'e3', sport_key: 'x', commence_time: '2026-09-26T01:00:00Z', home_team: 'A', away_team: 'B', completed: true, scores: [{ name: 'A', score: '2' }], last_update: null });
    expect(broken).toBeNull();
  });
});

describe('football-data.org → fixtures', () => {
  const m = {
    id: 537000, utcDate: '2026-09-27T14:00:00Z', status: 'FINISHED', matchday: 6,
    homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: 'https://crests.football-data.org/57.png' },
    awayTeam: { id: 64, name: 'Liverpool FC', shortName: 'Liverpool', tla: 'LIV', crest: 'https://crests.football-data.org/64.png' },
    score: { fullTime: { home: 1, away: 1 }, halfTime: { home: 0, away: 1 } },
    referees: [{ name: 'Michael Oliver', type: 'REFEREE' }, { name: 'X', type: 'ASSISTANT_REFEREE_N1' }],
  };
  it('terminado con descanso y árbitro', () => {
    const f = fdMatchToFixture(m)!;
    expect(f).toMatchObject({ source: 'football_data', external_id: '537000', status: 'FT', home_goals: 1, away_goals: 1, ht_home_goals: 0, ht_away_goals: 1, referee: 'Michael Oliver', round: 'Matchday 6' });
    expect(f.home_logo).toContain('57.png');
  });
  it('programado sin marcador', () => {
    const f = fdMatchToFixture({ ...m, status: 'TIMED', score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } } })!;
    expect(f.status).toBe('NS');
    expect(f.home_goals).toBeNull();
  });
});
