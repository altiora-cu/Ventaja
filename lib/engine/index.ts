import { scoreMatrix, topScores } from './dixon-coles';
import { priceOutcomes } from './edge';
import { halfMarkets } from './halves';
import { fullTimeMarkets } from './markets';
import { playerMarkets } from './players';
import { propMarkets } from './props';
import { expectedGoals } from './rating';
import type { EngineResult, FixtureInput, OddsQuote, PricedOutcome } from './types';

export * from './types';
export { sello, qualifiesAsPick, priceOutcomes } from './edge';
export { buildCombos, COMBO_RULES } from './combos';
export { expectedGoals } from './rating';
export { scoreMatrix, topScores } from './dixon-coles';

/** Ejecuta el modelo completo para un partido. Función pura (sin IO). */
export function analyzeFixture(input: FixtureInput): EngineResult {
  const lambdas = expectedGoals(input.home, input.away, input.league);
  const matrix = scoreMatrix(lambdas.home, lambdas.away);
  const scores = topScores(matrix, 4);
  const htShare = input.home.ht_share ?? input.league.ht_share;

  const outcomes = [
    ...fullTimeMarkets(matrix),
    ...halfMarkets(lambdas.home, lambdas.away, htShare),
    ...propMarkets(input.home, input.away, input.league, input.referee_cards_avg),
    ...playerMarkets(input.players, [
      { team_id: input.home.id, lambda: lambdas.home },
      { team_id: input.away.id, lambda: lambdas.away },
    ]),
  ];

  return { lambda_home: lambdas.home, lambda_away: lambdas.away, matrix, scores, outcomes };
}

/** Modelo + cuotas → selecciones con ventaja y sello. */
export function predictFixture(input: FixtureInput, quotes: OddsQuote[]): EngineResult & { priced: PricedOutcome[] } {
  const res = analyzeFixture(input);
  return { ...res, priced: priceOutcomes(res.outcomes, quotes) };
}

/** El pick principal del partido: mayor ventaja entre los que cumplen umbral; si ninguno, el de mayor probabilidad en 1x2/dc/totals. */
export function topPick(priced: PricedOutcome[]): PricedOutcome | null {
  const withEdge = priced.filter((p) => p.edge !== null && p.prob >= 0.5 && p.market !== 'correct_score');
  if (withEdge.length) {
    return [...withEdge].sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0) || b.prob - a.prob)[0];
  }
  const core = priced.filter((p) => ['1x2', 'dc', 'totals', 'btts'].includes(p.market));
  return core.length ? [...core].sort((a, b) => b.prob - a.prob)[0] : null;
}
