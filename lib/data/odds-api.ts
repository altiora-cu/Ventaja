import 'server-only';

/** Cliente mínimo de The Odds API (v4). Solo servidor. */
const BASE = 'https://api.the-odds-api.com/v4';

export interface OaOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}
export interface OaMarket {
  key: string;
  last_update: string;
  outcomes: OaOutcome[];
}
export interface OaBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OaMarket[];
}
export interface OaEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OaBookmaker[];
}

export class OddsApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface OddsUsage {
  remaining: number | null;
  used: number | null;
}

let lastUsage: OddsUsage = { remaining: null, used: null };
export function oddsUsage(): OddsUsage {
  return lastUsage;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new OddsApiError('Falta ODDS_API_KEY');
  const qs = new URLSearchParams({ apiKey: key, ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { cache: 'no-store' });
  lastUsage = {
    remaining: Number(res.headers.get('x-requests-remaining') ?? NaN) || null,
    used: Number(res.headers.get('x-requests-used') ?? NaN) || null,
  };
  if (!res.ok) throw new OddsApiError(`Odds API ${path} → ${res.status}`, res.status);
  return (await res.json()) as T;
}

export const ODDS_REGIONS = process.env.ODDS_REGIONS ?? 'us,eu';
export const MAIN_MARKETS = 'h2h,totals,spreads';
export const EXTRA_MARKETS = 'btts,h2h_h1,totals_h1';

export const oddsApi = {
  /** Cuotas principales de todos los eventos próximos del deporte (coste: regiones × mercados). */
  sportOdds: (sportKey: string) =>
    get<OaEvent[]>(`/sports/${sportKey}/odds`, { regions: ODDS_REGIONS, markets: MAIN_MARKETS, oddsFormat: 'decimal', dateFormat: 'iso' }),
  /** Mercados adicionales de un evento concreto (BTTS, 1T). */
  eventOdds: (sportKey: string, eventId: string) =>
    get<OaEvent>(`/sports/${sportKey}/events/${eventId}/odds`, { regions: 'eu', markets: EXTRA_MARKETS, oddsFormat: 'decimal', dateFormat: 'iso' }),
};

export interface NormalizedQuote {
  bookmaker: string;
  market: string;
  selection: string;
  line: number | null;
  price: number;
}

/** Traduce los mercados de The Odds API a nuestro esquema (1x2, totals, ah, btts, ht). */
export function normalizeEvent(ev: OaEvent): NormalizedQuote[] {
  const out: NormalizedQuote[] = [];
  for (const b of ev.bookmakers) {
    for (const m of b.markets) {
      for (const o of m.outcomes) {
        if (!o.price || o.price <= 1) continue;
        switch (m.key) {
          case 'h2h':
            out.push({ bookmaker: b.key, market: '1x2', selection: o.name === ev.home_team ? 'home' : o.name === ev.away_team ? 'away' : 'draw', line: null, price: o.price });
            break;
          case 'totals':
            if (o.point === undefined) break;
            out.push({ bookmaker: b.key, market: 'totals', selection: o.name.toLowerCase() === 'over' ? 'over' : 'under', line: o.point, price: o.price });
            break;
          case 'spreads':
            if (o.point === undefined) break;
            out.push({ bookmaker: b.key, market: 'ah', selection: o.name === ev.home_team ? 'ah_home' : 'ah_away', line: o.point, price: o.price });
            break;
          case 'btts':
            out.push({ bookmaker: b.key, market: 'btts', selection: o.name.toLowerCase() === 'yes' ? 'yes' : 'no', line: null, price: o.price });
            break;
          case 'h2h_h1':
            out.push({ bookmaker: b.key, market: 'ht', selection: o.name === ev.home_team ? 'ht_home' : o.name === ev.away_team ? 'ht_away' : 'ht_draw', line: null, price: o.price });
            break;
          case 'totals_h1':
            if (o.point === undefined) break;
            out.push({ bookmaker: b.key, market: 'ht', selection: o.name.toLowerCase() === 'over' ? 'ht_over' : 'ht_under', line: o.point, price: o.price });
            break;
          default:
            break;
        }
      }
    }
  }
  return out;
}
