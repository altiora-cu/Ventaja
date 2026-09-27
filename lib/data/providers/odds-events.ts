import type { League } from '@/lib/db/types';
import type { OaEventLite, OaScore } from '../odds-api';
import type { ProviderFixture } from './types';

/** Normalizadores puros (testeables) del calendario y resultados de The Odds API. */

export function eventToFixture(ev: OaEventLite): ProviderFixture {
  return {
    source: 'odds_api',
    external_id: ev.id,
    odds_event_id: ev.id,
    kickoff: ev.commence_time,
    home_name: ev.home_team,
    away_name: ev.away_team,
    status: 'NS',
  };
}

export function scoreToFixture(sc: OaScore): ProviderFixture | null {
  const base: ProviderFixture = {
    source: 'odds_api',
    external_id: sc.id,
    odds_event_id: sc.id,
    kickoff: sc.commence_time,
    home_name: sc.home_team,
    away_name: sc.away_team,
    status: 'NS',
  };
  if (!sc.completed) {
    const started = new Date(sc.commence_time).getTime() < Date.now();
    return { ...base, status: started && sc.scores ? '2H' : 'NS' };
  }
  const h = sc.scores?.find((s) => s.name === sc.home_team)?.score;
  const a = sc.scores?.find((s) => s.name === sc.away_team)?.score;
  if (h === undefined || a === undefined) return null;
  const hg = Number(h);
  const ag = Number(a);
  if (!Number.isFinite(hg) || !Number.isFinite(ag)) return null;
  return { ...base, status: 'FT', home_goals: hg, away_goals: ag };
}

export function supportsOdds(league: League): boolean {
  return Boolean(league.odds_sport_key);
}
