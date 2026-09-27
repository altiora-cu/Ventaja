import type { ProviderFixture } from './types';

/** Subconjunto de la respuesta de football-data.org v4 /competitions/{code}/matches. */
export interface FdMatch {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED' | 'AWARDED' | string;
  matchday: number | null;
  homeTeam: { id: number; name: string; shortName?: string | null; tla?: string | null; crest?: string | null };
  awayTeam: { id: number; name: string; shortName?: string | null; tla?: string | null; crest?: string | null };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  referees?: Array<{ name: string; type: string }>;
}

const STATUS: Record<string, string> = {
  SCHEDULED: 'NS',
  TIMED: 'NS',
  IN_PLAY: '2H',
  PAUSED: 'HT',
  FINISHED: 'FT',
  POSTPONED: 'PST',
  SUSPENDED: 'SUSP',
  CANCELLED: 'CANC',
  AWARDED: 'AWD',
};

export function fdMatchToFixture(m: FdMatch): ProviderFixture | null {
  if (!m.homeTeam?.name || !m.awayTeam?.name) return null;
  const finished = m.status === 'FINISHED';
  const referee = m.referees?.find((r) => r.type === 'REFEREE')?.name ?? null;
  return {
    source: 'football_data',
    external_id: String(m.id),
    kickoff: m.utcDate,
    home_name: m.homeTeam.name,
    away_name: m.awayTeam.name,
    home_logo: m.homeTeam.crest ?? null,
    away_logo: m.awayTeam.crest ?? null,
    home_external_id: String(m.homeTeam.id),
    away_external_id: String(m.awayTeam.id),
    status: STATUS[m.status] ?? 'NS',
    home_goals: finished ? m.score.fullTime.home : null,
    away_goals: finished ? m.score.fullTime.away : null,
    ht_home_goals: finished ? m.score.halfTime.home : null,
    ht_away_goals: finished ? m.score.halfTime.away : null,
    referee,
    round: m.matchday ? `Matchday ${m.matchday}` : null,
  };
}
