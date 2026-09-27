/** Tipos de filas de Postgres (espejo de supabase/migrations/0001_init.sql). */

export type Role = 'user' | 'admin';
export type AccountStatus = 'trial' | 'activa' | 'vencida' | 'suspendida';
export type Sello = 'alta' | 'media' | 'baja';
export type PickResult = 'acierto' | 'fallo' | 'nulo';

export interface Profile {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  trial_ends_at: string;
  paid_until: string | null;
  locale: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export type DataSource = 'api_football' | 'odds_api' | 'football_data';

export interface League {
  id: number;
  name: string;
  country: string | null;
  logo: string | null;
  season: number;
  odds_sport_key: string | null;
  fd_code: string | null;
  active: boolean;
}

export interface Team {
  id: number;
  name: string;
  short_name: string | null;
  logo: string | null;
  country: string | null;
  slug: string | null;
  source: DataSource | null;
  external_id: string | null;
}

export interface Referee {
  name: string;
  cards_avg: number | null;
  matches: number;
}

export interface FixtureStats {
  corners?: { home: number; away: number };
  cards?: { home: number; away: number };
  yellow?: { home: number; away: number };
  red?: { home: number; away: number };
  shots?: { home: number; away: number };
  sot?: { home: number; away: number };
  xg?: { home: number; away: number };
  players?: Array<{ player_id: number; team_id: number; goals: number; sot: number; minutes: number }>;
}

export interface Fixture {
  id: number;
  league_id: number;
  season: number;
  round: string | null;
  kickoff: string;
  home_id: number;
  away_id: number;
  venue: string | null;
  city: string | null;
  referee: string | null;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  ht_home_goals: number | null;
  ht_away_goals: number | null;
  stats: FixtureStats | null;
  source: DataSource | null;
  external_id: string | null;
  odds_event_id: string | null;
  updated_at: string;
}

export interface SplitStats {
  played: number;
  gf: number;
  gc: number;
  xg?: number | null;
  xga?: number | null;
  wins?: number;
  draws?: number;
  losses?: number;
}

export interface RecentMatch {
  fixture_id: number;
  date: string;
  home: boolean;
  gf: number;
  gc: number;
  xg?: number | null;
  xga?: number | null;
  result: 'W' | 'D' | 'L';
  opponent_id?: number;
  opponent?: string;
}

export interface TeamStats {
  team_id: number;
  league_id: number;
  season: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  gc: number;
  xg: number | null;
  xga: number | null;
  corners_for: number | null;
  corners_against: number | null;
  cards_for: number | null;
  cards_against: number | null;
  shots_for: number | null;
  shots_against: number | null;
  sot_for: number | null;
  sot_against: number | null;
  home: SplitStats | null;
  away: SplitStats | null;
  halves: { ht_gf: number; ht_gc: number; sh_gf: number; sh_gc: number } | null;
  form: string | null;
  recent: RecentMatch[] | null;
  elo: number;
  updated_at: string;
}

export interface PlayerStats {
  player_id: number;
  team_id: number;
  league_id: number;
  season: number;
  name: string;
  position: string | null;
  photo: string | null;
  appearances: number;
  lineups: number;
  minutes: number;
  goals: number;
  xg: number | null;
  shots: number | null;
  sot: number | null;
}

export interface Injury {
  id: number;
  fixture_id: number | null;
  team_id: number;
  player_id: number | null;
  player_name: string | null;
  type: string | null;
  reason: string | null;
}

export interface Odd {
  id: number;
  fixture_id: number;
  bookmaker: string;
  market: string;
  selection: string;
  line: number | null;
  price: number;
  fetched_at: string;
}

export interface Prediction {
  id: number;
  fixture_id: number;
  market: string;
  selection: string;
  line: number | null;
  player_id: number | null;
  player_name: string | null;
  prob: number;
  best_price: number | null;
  best_bookmaker: string | null;
  implied_prob: number | null;
  edge: number | null;
  sello: Sello;
  calculated_at: string;
}

export interface TopMarket {
  market: string;
  selection: string;
  line: number | null;
  player_name?: string | null;
  prob: number;
  best_price: number | null;
  best_bookmaker?: string | null;
  edge: number | null;
  sello: Sello;
  /** true si algún equipo tiene < 5 partidos: la probabilidad se mezcló con el mercado. */
  small_sample?: boolean;
  min_played?: number;
}

export type AiVerdict = 'concuerda' | 'cautela' | 'discrepa';

/** Revisión IA del pick principal: audita el pick del modelo y solo puede bajar el sello. */
export interface AiReview {
  verdict: AiVerdict;
  risks: string[];
  note: string;
  sello_modelo: Sello;
  sello_final: Sello;
  model: string;
  key: string;
  at: string;
}

export interface FixtureAnalysis {
  fixture_id: number;
  lambda_home: number | null;
  lambda_away: number | null;
  scores: Array<{ home: number; away: number; prob: number }> | null;
  lectura: string | null;
  lectura_en: string | null;
  lectura_locale: string | null;
  ai_review: AiReview | null;
  lectura_sello: string | null;
  top_market: TopMarket | null;
  calculated_at: string;
}

export interface PickHistory {
  id: number;
  fixture_id: number;
  market: string;
  selection: string;
  line: number | null;
  player_id: number | null;
  player_name: string | null;
  prob: number;
  price: number | null;
  sello: Sello;
  result: PickResult;
  units: number;
  settled_at: string;
}

/** Fixture con equipos y liga embebidos (join habitual). */
export interface FixtureFull extends Fixture {
  league: League;
  home: Team;
  away: Team;
}
