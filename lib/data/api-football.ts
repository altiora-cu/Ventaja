import 'server-only';

/**
 * Cliente mínimo y tipado de API-Football (v3). Solo servidor.
 * Todas las respuestas se guardan en Postgres; nunca se llama desde el cliente.
 */
const BASE = 'https://v3.football.api-sports.io';

export class ApiFootballError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new ApiFootballError('Falta API_FOOTBALL_KEY');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { 'x-apisports-key': key },
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiFootballError(`API-Football ${path} → ${res.status}`, res.status);
  const json = (await res.json()) as { response: T[]; errors?: Record<string, string> | unknown[]; results?: number };
  if (json.errors && !Array.isArray(json.errors) && Object.keys(json.errors).length) {
    throw new ApiFootballError(`API-Football ${path}: ${JSON.stringify(json.errors)}`);
  }
  return json.response ?? [];
}

// ---------------------------------------------------------------------------
// Tipos (subconjunto que usamos)
// ---------------------------------------------------------------------------
export interface AfFixture {
  fixture: {
    id: number;
    referee: string | null;
    date: string;
    timestamp: number;
    venue: { id: number | null; name: string | null; city: string | null };
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; logo: string; season: number; round: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null }; fulltime: { home: number | null; away: number | null } };
}

export interface AfStatistics {
  team: { id: number; name: string; logo: string };
  statistics: Array<{ type: string; value: number | string | null }>;
}

export interface AfFixturePlayers {
  team: { id: number; name: string; logo: string };
  players: Array<{
    player: { id: number; name: string; photo: string };
    statistics: Array<{
      games: { minutes: number | null; position: string | null; substitute: boolean };
      shots: { total: number | null; on: number | null };
      goals: { total: number | null };
    }>;
  }>;
}

export interface AfLineup {
  team: { id: number; name: string; logo: string };
  formation: string | null;
  startXI: Array<{ player: { id: number; name: string; number: number; pos: string; grid: string | null } }>;
  substitutes: Array<{ player: { id: number; name: string; number: number; pos: string } }>;
}

export interface AfInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string; logo: string };
  fixture: { id: number; date: string };
  league: { id: number; season: number };
}

export interface AfPlayerSeason {
  player: { id: number; name: string; photo: string };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    league: { id: number; season: number };
    games: { appearences: number | null; lineups: number | null; minutes: number | null; position: string | null };
    shots: { total: number | null; on: number | null };
    goals: { total: number | null };
  }>;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export const apiFootball = {
  fixturesByRange: (league: number, season: number, from: string, to: string) =>
    get<AfFixture>('/fixtures', { league, season, from, to, timezone: 'UTC' }),
  fixturesBySeason: (league: number, season: number) => get<AfFixture>('/fixtures', { league, season, timezone: 'UTC' }),
  fixtureStatistics: (fixture: number) => get<AfStatistics>('/fixtures/statistics', { fixture }),
  fixturePlayers: (fixture: number) => get<AfFixturePlayers>('/fixtures/players', { fixture }),
  fixtureLineups: (fixture: number) => get<AfLineup>('/fixtures/lineups', { fixture }),
  injuriesByFixture: (fixture: number) => get<AfInjury>('/injuries', { fixture }),
  injuriesByLeagueDate: (league: number, season: number, date: string) => get<AfInjury>('/injuries', { league, season, date }),
  players: async (league: number, season: number): Promise<AfPlayerSeason[]> => {
    // Paginado: respetamos paging.total
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new ApiFootballError('Falta API_FOOTBALL_KEY');
    const all: AfPlayerSeason[] = [];
    let page = 1;
    let total = 1;
    do {
      const res = await fetch(`${BASE}/players?league=${league}&season=${season}&page=${page}`, { headers: { 'x-apisports-key': key }, cache: 'no-store' });
      if (!res.ok) throw new ApiFootballError(`API-Football /players → ${res.status}`, res.status);
      const json = (await res.json()) as { response: AfPlayerSeason[]; paging: { current: number; total: number } };
      all.push(...(json.response ?? []));
      total = json.paging?.total ?? 1;
      page += 1;
    } while (page <= total && page <= 60);
    return all;
  },
};

/** Convierte la lista de estadísticas de API-Football a un mapa numérico. */
export function statMap(stats: AfStatistics['statistics']): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of stats) {
    if (s.value === null || s.value === undefined) continue;
    const n = typeof s.value === 'string' ? parseFloat(s.value.replace('%', '')) : s.value;
    if (!Number.isNaN(n)) out[s.type] = n;
  }
  return out;
}

export { FINISHED_STATUSES, LIVE_STATUSES } from './statuses';
