import type { Sello } from '@/lib/db/types';
import type { MarketKey, ModelOutcome, OddsQuote, PricedOutcome } from './types';

export const SELLO_ALTA = { prob: 0.65, edge: 0.08 };
export const SELLO_MEDIA = { prob: 0.55, edge: 0.05 };

export function sello(prob: number, edge: number | null): Sello {
  if (edge === null) return 'baja';
  if (prob >= SELLO_ALTA.prob && edge >= SELLO_ALTA.edge) return 'alta';
  if (prob >= SELLO_MEDIA.prob && edge >= SELLO_MEDIA.edge) return 'media';
  return 'baja';
}

/** Clave que agrupa las selecciones de un mismo mercado/línea para quitar el margen. */
export function marketGroupKey(market: MarketKey, selection: string, line: number | null, playerId?: number | null): string {
  switch (market) {
    case 'totals':
    case 'corners':
    case 'cards':
      return `${market}:${line}`;
    case 'team_totals':
    case 'sot':
      return `${market}:${selection.split('_')[0]}:${line}`;
    case 'ah':
      // ah_home +0.5 y ah_away −0.5 son el mismo mercado
      return `${market}:${Math.abs(line ?? 0)}`;
    case 'ht':
    case '2h': {
      const isTotal = selection.endsWith('_over') || selection.endsWith('_under');
      return isTotal ? `${market}:total:${line}` : `${market}:1x2`;
    }
    case 'player_sot':
      return `${market}:${playerId}:${line}`;
    case 'scorer':
      return `${market}:${playerId}`;
    default:
      return market;
  }
}

/** Mejor cuota por selección (entre casas). */
export function bestPrices(quotes: OddsQuote[]): Map<string, { price: number; bookmaker: string }> {
  const best = new Map<string, { price: number; bookmaker: string }>();
  for (const q of quotes) {
    const k = selectionKey(q.market, q.selection, q.line);
    const cur = best.get(k);
    if (!cur || q.price > cur.price) best.set(k, { price: q.price, bookmaker: q.bookmaker });
  }
  return best;
}

export function selectionKey(market: string, selection: string, line: number | null, playerId?: number | null): string {
  return `${market}|${selection}|${line ?? ''}|${playerId ?? ''}`;
}

/**
 * ventaja = prob_modelo − prob_implícita, con prob_implícita = (1/cuota) / Σ(1/cuotas del mercado)
 * calculada sobre la mejor cuota de cada selección del mercado.
 * Para mercados de dos vías donde falta una pata (ej. solo "over"), se asume margen 0 sobre la cuota.
 */
export function priceOutcomes(outcomes: ModelOutcome[], quotes: OddsQuote[]): PricedOutcome[] {
  const best = bestPrices(quotes);

  // Σ(1/mejor cuota) por grupo de mercado
  const groupSums = new Map<string, { sum: number; n: number; expected: number }>();
  for (const o of outcomes) {
    const g = marketGroupKey(o.market, o.selection, o.line, o.player_id);
    const entry = groupSums.get(g) ?? { sum: 0, n: 0, expected: 0 };
    entry.expected += 1;
    const b = best.get(selectionKey(o.market, o.selection, o.line, o.player_id));
    if (b) {
      entry.sum += 1 / b.price;
      entry.n += 1;
    }
    groupSums.set(g, entry);
  }

  return outcomes.map((o) => {
    const b = best.get(selectionKey(o.market, o.selection, o.line, o.player_id));
    if (!b) {
      return { ...o, best_price: null, best_bookmaker: null, implied_prob: null, edge: null, sello: 'baja' };
    }
    const g = groupSums.get(marketGroupKey(o.market, o.selection, o.line, o.player_id))!;
    const raw = 1 / b.price;
    // Quitar margen solo si tenemos todas las patas del mercado; si no, usar la cuota tal cual.
    const implied = g.n >= g.expected && g.sum > 0 ? raw / g.sum : raw;
    const edge = o.prob - implied;
    return { ...o, best_price: b.price, best_bookmaker: b.bookmaker, implied_prob: implied, edge, sello: sello(o.prob, edge) };
  });
}

/** Umbral para aparecer en "Mejores apuestas": ventaja ≥ 5% y probabilidad ≥ 55%. */
export function qualifiesAsPick(o: { prob: number; edge: number | null }): boolean {
  return o.edge !== null && o.edge >= 0.05 && o.prob >= 0.55;
}
