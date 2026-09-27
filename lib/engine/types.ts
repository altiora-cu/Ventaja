import type { Sello } from '@/lib/db/types';

export type MarketKey =
  | '1x2'
  | 'dc'
  | 'totals'
  | 'team_totals'
  | 'btts'
  | 'ah'
  | 'ht'
  | '2h'
  | 'corners'
  | 'cards'
  | 'sot'
  | 'player_sot'
  | 'scorer'
  | 'correct_score';

/** Orden de presentación en la ficha (abiertas por defecto: 1x2, totals, btts). */
export const MARKET_ORDER: MarketKey[] = ['1x2', 'dc', 'totals', 'team_totals', 'btts', 'ah', 'ht', '2h', 'corners', 'cards', 'sot', 'player_sot', 'scorer'];
export const MARKETS_OPEN_BY_DEFAULT: MarketKey[] = ['1x2', 'totals', 'btts'];

export interface ModelOutcome {
  market: MarketKey;
  selection: string;
  line: number | null;
  prob: number;
  player_id?: number | null;
  player_name?: string | null;
  /** Para hándicap entero: probabilidad de push (devolución). */
  push?: number;
}

export interface PricedOutcome extends ModelOutcome {
  best_price: number | null;
  best_bookmaker: string | null;
  implied_prob: number | null;
  edge: number | null;
  sello: Sello;
}

export interface TeamInput {
  id: number;
  name: string;
  elo: number;
  /** Partidos jugados como local/visita y goles/xG por partido en cada condición. */
  home: { played: number; gf: number; gc: number; xg: number | null; xga: number | null };
  away: { played: number; gf: number; gc: number; xg: number | null; xga: number | null };
  /** Últimos partidos (más reciente primero). */
  recent: Array<{ home: boolean; gf: number; gc: number; xg: number | null; xga: number | null; result: 'W' | 'D' | 'L' }>;
  /** Promedios por partido de props (temporada). */
  corners_for: number | null;
  corners_against: number | null;
  cards_for: number | null;
  cards_against: number | null;
  sot_for: number | null;
  sot_against: number | null;
  /** Reparto de goles por mitad (proporción 1T) si se conoce. */
  ht_share?: number | null;
  /** Titulares ausentes confirmados. */
  missing_starters: number;
}

export interface PlayerInput {
  id: number;
  name: string;
  team_id: number;
  minutes: number;
  appearances: number;
  lineups: number;
  goals: number;
  shots: number | null;
  sot: number | null;
  xg: number | null;
  /** true si está en la alineación confirmada como titular; null si se desconoce. */
  starter: boolean | null;
}

export interface LeagueAverages {
  /** Goles por partido del local y del visitante (promedio liga). */
  home_goals: number;
  away_goals: number;
  corners: number; // total por partido
  cards: number; // total por partido
  sot: number; // total por partido
  /** Proporción de goles en el primer tiempo. */
  ht_share: number;
}

export interface FixtureInput {
  fixture_id: number;
  home: TeamInput;
  away: TeamInput;
  league: LeagueAverages;
  referee_cards_avg: number | null;
  players: PlayerInput[];
}

export interface ScoreProb {
  home: number;
  away: number;
  prob: number;
}

export interface EngineResult {
  lambda_home: number;
  lambda_away: number;
  matrix: number[][];
  scores: ScoreProb[];
  outcomes: ModelOutcome[];
}

export interface OddsQuote {
  bookmaker: string;
  market: MarketKey;
  selection: string;
  line: number | null;
  price: number;
}
