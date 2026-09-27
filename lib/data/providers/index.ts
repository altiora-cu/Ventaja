import 'server-only';
import type { League } from '@/lib/db/types';
import { oddsApi } from '../odds-api';
import { eventToFixture, scoreToFixture, supportsOdds } from './odds-events';
import { footballDataSeason, supportsFootballData } from './football-data';
import type { FixtureProvider, ProviderFixture } from './types';

/** Proveedor The Odds API: calendario (0 créditos) y resultados (2 créditos por liga). */
export const oddsProvider: FixtureProvider = {
  key: 'odds_api',
  supports: supportsOdds,
  async upcoming(league) {
    const events = await oddsApi.events(league.odds_sport_key!);
    return events.map(eventToFixture);
  },
  async results(league, daysBack) {
    const scores = await oddsApi.scores(league.odds_sport_key!, Math.min(3, Math.max(1, daysBack)));
    return scores.map(scoreToFixture).filter((f): f is ProviderFixture => f !== null && f.status === 'FT');
  },
};

/** Proveedor football-data.org: toda la temporada en una llamada (próximos y resultados). */
export const footballDataProvider: FixtureProvider = {
  key: 'football_data',
  supports: supportsFootballData,
  async upcoming(league) {
    return footballDataSeason(league);
  },
  async results(league) {
    return (await footballDataSeason(league)).filter((f) => f.status === 'FT');
  },
};

/**
 * Proveedor maestro por liga: football-data si la liga tiene código y hay clave (temporada completa,
 * descanso, árbitro); si no, The Odds API. Devuelve null si ninguno la cubre.
 */
export function masterProvider(league: League): FixtureProvider | null {
  if (footballDataProvider.supports(league)) return footballDataProvider;
  if (oddsProvider.supports(league)) return oddsProvider;
  return null;
}
