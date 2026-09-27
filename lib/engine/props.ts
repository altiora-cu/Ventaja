import { negBinOver, poissonOver } from './poisson';
import type { LeagueAverages, ModelOutcome, TeamInput } from './types';

export const CORNER_LINES = [8.5, 9.5, 10.5];
export const CARD_LINES = [3.5, 4.5, 5.5];
export const CARDS_DISPERSION = 6; // binomial negativa: var = μ + μ²/k

/** esperado = promedio_equipo_hace × promedio_rival_concede / media_liga (por equipo). */
export function expectedProp(teamFor: number | null, rivalAgainst: number | null, leagueTotal: number): number {
  const perTeam = leagueTotal / 2;
  const f = teamFor ?? perTeam;
  const a = rivalAgainst ?? perTeam;
  return (f * a) / perTeam;
}

/** Solo se emite un prop si al menos un equipo tiene datos reales de ese prop (sin API-Football no los hay). */
function hasData(a: number | null, b: number | null, c: number | null, d: number | null): boolean {
  return [a, b, c, d].some((v) => v !== null && v !== undefined);
}

export function propMarkets(home: TeamInput, away: TeamInput, league: LeagueAverages, refereeCardsAvg: number | null): ModelOutcome[] {
  const out: ModelOutcome[] = [];
  const cornersOk = hasData(home.corners_for, home.corners_against, away.corners_for, away.corners_against);
  const cardsOk = hasData(home.cards_for, home.cards_against, away.cards_for, away.cards_against);
  const sotOk = hasData(home.sot_for, home.sot_against, away.sot_for, away.sot_against);
  if (!cornersOk && !cardsOk && !sotOk) return out;

  // Corners (Poisson sobre el total)
  const cornersHome = expectedProp(home.corners_for, away.corners_against, league.corners);
  const cornersAway = expectedProp(away.corners_for, home.corners_against, league.corners);
  const cornersTotal = cornersHome + cornersAway;
  for (const line of cornersOk ? CORNER_LINES : []) {
    const over = poissonOver(line, cornersTotal);
    out.push({ market: 'corners', selection: 'over', line, prob: over });
    out.push({ market: 'corners', selection: 'under', line, prob: 1 - over });
  }

  // Tarjetas (binomial negativa, factor árbitro)
  const refFactor = refereeCardsAvg && league.cards > 0 ? refereeCardsAvg / league.cards : 1;
  const cardsTotal = (expectedProp(home.cards_for, away.cards_against, league.cards) + expectedProp(away.cards_for, home.cards_against, league.cards)) * refFactor;
  for (const line of cardsOk ? CARD_LINES : []) {
    const over = negBinOver(line, cardsTotal, CARDS_DISPERSION);
    out.push({ market: 'cards', selection: 'over', line, prob: over });
    out.push({ market: 'cards', selection: 'under', line, prob: 1 - over });
  }

  // Tiros a puerta por equipo (Poisson), líneas alrededor de lo esperado
  const sotHome = expectedProp(home.sot_for, away.sot_against, league.sot);
  const sotAway = expectedProp(away.sot_for, home.sot_against, league.sot);
  for (const [side, mu] of sotOk
    ? ([
        ['home', sotHome],
        ['away', sotAway],
      ] as const)
    : []) {
    const base = Math.max(1, Math.floor(mu));
    for (const line of [base - 0.5, base + 0.5]) {
      const over = poissonOver(line, mu);
      out.push({ market: 'sot', selection: `${side}_over`, line, prob: over });
      out.push({ market: 'sot', selection: `${side}_under`, line, prob: 1 - over });
    }
  }

  return out;
}
