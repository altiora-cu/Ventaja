import 'server-only';
import type { League } from '@/lib/db/types';
import type { ProviderFixture } from './types';
import { fdMatchToFixture, type FdMatch } from './football-data-normalize';

/**
 * football-data.org v4 (plan gratis: Premier League y otras 11 competiciones, 10 llamadas/min).
 * Una sola llamada devuelve toda la temporada: próximos, terminados, descanso y árbitro.
 */
const BASE = 'https://api.football-data.org/v4';

export class FootballDataError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) throw new FootballDataError('Falta FOOTBALL_DATA_KEY');
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Auth-Token': key }, cache: 'no-store' });
  if (!res.ok) throw new FootballDataError(`football-data ${path} → ${res.status}`, res.status);
  return (await res.json()) as T;
}

export const footballData = {
  /** Todos los partidos de la temporada actual de la competición (ej. 'PL'). */
  seasonMatches: async (code: string): Promise<FdMatch[]> => {
    const json = await get<{ matches: FdMatch[] }>(`/competitions/${code}/matches`);
    return json.matches ?? [];
  },
};

export function supportsFootballData(league: League): boolean {
  return Boolean(league.fd_code) && Boolean(process.env.FOOTBALL_DATA_KEY);
}

export async function footballDataSeason(league: League): Promise<ProviderFixture[]> {
  const matches = await footballData.seasonMatches(league.fd_code!);
  return matches.map(fdMatchToFixture).filter((f): f is ProviderFixture => f !== null);
}
