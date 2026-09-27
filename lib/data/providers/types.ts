import type { DataSource, League } from '@/lib/db/types';

/** Partido tal como lo entrega un proveedor, ya normalizado a nuestro modelo. */
export interface ProviderFixture {
  source: DataSource;
  external_id: string;
  /** Id del evento en The Odds API si el proveedor lo conoce (para cuotas/resultados). */
  odds_event_id?: string | null;
  kickoff: string; // ISO
  home_name: string;
  away_name: string;
  home_logo?: string | null;
  away_logo?: string | null;
  home_external_id?: string | null;
  away_external_id?: string | null;
  status: string; // NS | FT | PST | 1H...
  home_goals?: number | null;
  away_goals?: number | null;
  ht_home_goals?: number | null;
  ht_away_goals?: number | null;
  referee?: string | null;
  round?: string | null;
}

export interface FixtureProvider {
  key: DataSource;
  /** ¿Puede servir esta liga? */
  supports(league: League): boolean;
  /** Partidos próximos (y, si el proveedor lo permite, toda la temporada). */
  upcoming(league: League): Promise<ProviderFixture[]>;
  /** Resultados recientes (últimos `daysBack` días). */
  results(league: League, daysBack: number): Promise<ProviderFixture[]>;
}
