import { describe, expect, it } from 'vitest';
import { analyzeFixture, buildCombos, predictFixture, sello, topPick } from './index';
import { negBinPmf, poissonCdf, poissonOver, poissonPmf } from './poisson';
import { scoreMatrix, sumWhere } from './dixon-coles';
import { computeLeagueElo, eloExpected } from './elo';
import { priceOutcomes } from './edge';
import type { FixtureInput, LeagueAverages, ModelOutcome, OddsQuote, TeamInput } from './types';
import { lecturaFallback } from './lectura-prompt';

const league: LeagueAverages = { home_goals: 1.5, away_goals: 1.15, corners: 9.8, cards: 4.4, sot: 8.6, ht_share: 0.44 };

function team(over: Partial<TeamInput> & { id: number; name: string }): TeamInput {
  return {
    elo: 1500,
    home: { played: 8, gf: 12, gc: 8, xg: 11.5, xga: 8.2 },
    away: { played: 8, gf: 9, gc: 10, xg: 8.8, xga: 10.4 },
    recent: [],
    corners_for: 4.9,
    corners_against: 4.9,
    cards_for: 2.2,
    cards_against: 2.2,
    sot_for: 4.3,
    sot_against: 4.3,
    missing_starters: 0,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// 3 partidos de referencia con resultado conocido
// ---------------------------------------------------------------------------

/** 1. Favorito claro en casa: Tigres 3–0 Pumas (Liga MX). Tigres 1.8 xG local, Pumas 3 derrotas seguidas sin su 9. */
const tigresPumas: FixtureInput = {
  fixture_id: 1,
  league,
  referee_cards_avg: 4.9,
  players: [
    { id: 10, name: 'A. Gignac', team_id: 100, minutes: 1250, appearances: 15, lineups: 14, goals: 9, shots: 48, sot: 22, xg: null, starter: true },
    { id: 11, name: 'N. Ibáñez', team_id: 100, minutes: 1100, appearances: 14, lineups: 12, goals: 4, shots: 30, sot: 12, xg: null, starter: true },
    { id: 12, name: 'J. Dinenno', team_id: 200, minutes: 900, appearances: 12, lineups: 9, goals: 3, shots: 25, sot: 9, xg: null, starter: null },
  ],
  home: team({
    id: 100,
    name: 'Tigres',
    elo: 1620,
    home: { played: 8, gf: 16, gc: 5, xg: 14.4, xga: 6.1 },
    recent: [
      { home: true, gf: 2, gc: 0, xg: 1.9, xga: 0.6, result: 'W' },
      { home: false, gf: 1, gc: 1, xg: 1.2, xga: 1.0, result: 'D' },
      { home: true, gf: 3, gc: 1, xg: 2.1, xga: 0.9, result: 'W' },
      { home: false, gf: 2, gc: 1, xg: 1.6, xga: 1.1, result: 'W' },
      { home: true, gf: 1, gc: 0, xg: 1.7, xga: 0.5, result: 'W' },
    ],
  }),
  away: team({
    id: 200,
    name: 'Pumas',
    elo: 1440,
    away: { played: 8, gf: 6, gc: 15, xg: 7.0, xga: 13.8 },
    missing_starters: 2,
    recent: [
      { home: false, gf: 0, gc: 2, xg: 0.7, xga: 1.8, result: 'L' },
      { home: true, gf: 1, gc: 3, xg: 1.0, xga: 2.2, result: 'L' },
      { home: false, gf: 0, gc: 1, xg: 0.5, xga: 1.5, result: 'L' },
      { home: true, gf: 2, gc: 2, xg: 1.4, xga: 1.6, result: 'D' },
      { home: false, gf: 1, gc: 0, xg: 0.9, xga: 1.1, result: 'W' },
    ],
  }),
};

/** 2. Partido parejo, pocos goles: Liverpool 1–1 Arsenal. */
const liverpoolArsenal: FixtureInput = {
  fixture_id: 2,
  league: { ...league, home_goals: 1.6, away_goals: 1.3 },
  referee_cards_avg: 3.6,
  players: [],
  home: team({
    id: 300,
    name: 'Liverpool',
    elo: 1700,
    home: { played: 10, gf: 19, gc: 8, xg: 18.2, xga: 9.0 },
    recent: [
      { home: true, gf: 2, gc: 1, xg: 1.8, xga: 1.1, result: 'W' },
      { home: false, gf: 1, gc: 1, xg: 1.4, xga: 1.3, result: 'D' },
      { home: true, gf: 1, gc: 0, xg: 1.5, xga: 0.8, result: 'W' },
      { home: false, gf: 2, gc: 2, xg: 1.9, xga: 1.7, result: 'D' },
    ],
  }),
  away: team({
    id: 400,
    name: 'Arsenal',
    elo: 1690,
    away: { played: 10, gf: 15, gc: 7, xg: 14.5, xga: 7.6 },
    recent: [
      { home: false, gf: 1, gc: 0, xg: 1.3, xga: 0.7, result: 'W' },
      { home: true, gf: 2, gc: 0, xg: 2.0, xga: 0.6, result: 'W' },
      { home: false, gf: 0, gc: 0, xg: 0.9, xga: 0.8, result: 'D' },
      { home: true, gf: 3, gc: 1, xg: 2.4, xga: 1.0, result: 'W' },
    ],
  }),
};

/** 3. Visitante favorito y muchos goles: Cusco FC 1–4 Universitario (Liga 1 Perú). */
const cuscoUniversitario: FixtureInput = {
  fixture_id: 3,
  league: { ...league, home_goals: 1.45, away_goals: 1.05, cards: 5.1 },
  referee_cards_avg: 6.2,
  players: [],
  home: team({
    id: 500,
    name: 'Cusco FC',
    elo: 1420,
    home: { played: 9, gf: 9, gc: 14, xg: 9.5, xga: 13.9 },
    recent: [
      { home: true, gf: 1, gc: 2, xg: 1.1, xga: 1.9, result: 'L' },
      { home: false, gf: 0, gc: 3, xg: 0.6, xga: 2.4, result: 'L' },
      { home: true, gf: 2, gc: 2, xg: 1.5, xga: 1.7, result: 'D' },
    ],
  }),
  away: team({
    id: 600,
    name: 'Universitario',
    elo: 1640,
    away: { played: 9, gf: 17, gc: 6, xg: 15.8, xga: 6.9 },
    recent: [
      { home: false, gf: 3, gc: 0, xg: 2.3, xga: 0.5, result: 'W' },
      { home: true, gf: 2, gc: 1, xg: 1.9, xga: 0.9, result: 'W' },
      { home: false, gf: 2, gc: 1, xg: 1.7, xga: 1.0, result: 'W' },
      { home: true, gf: 4, gc: 0, xg: 2.8, xga: 0.4, result: 'W' },
    ],
  }),
};

const find = (outcomes: ModelOutcome[], market: string, selection: string, line: number | null = null) =>
  outcomes.find((o) => o.market === market && o.selection === selection && (line === null ? o.line === null : o.line === line))!;

describe('distribuciones', () => {
  it('poisson suma 1 y cdf coherente', () => {
    let s = 0;
    for (let k = 0; k < 30; k++) s += poissonPmf(k, 2.5);
    expect(s).toBeCloseTo(1, 6);
    expect(poissonCdf(2, 2.5)).toBeCloseTo(0.5438, 3);
    expect(poissonOver(2.5, 2.5)).toBeCloseTo(1 - 0.5438, 3);
  });
  it('binomial negativa suma 1', () => {
    let s = 0;
    for (let k = 0; k < 80; k++) s += negBinPmf(k, 4.4, 6);
    expect(s).toBeCloseTo(1, 5);
  });
});

describe('Dixon-Coles', () => {
  it('matriz normalizada y ρ negativo sube 0-0 y 1-1', () => {
    const dc = scoreMatrix(1.5, 1.2, -0.1);
    const ind = scoreMatrix(1.5, 1.2, 0);
    expect(sumWhere(dc, () => true)).toBeCloseTo(1, 9);
    expect(dc[0][0]).toBeGreaterThan(ind[0][0]);
    expect(dc[1][1]).toBeGreaterThan(ind[1][1]);
    expect(dc[1][0]).toBeLessThan(ind[1][0]);
  });
});

describe('Elo', () => {
  it('ventaja local +60 y actualización K=20', () => {
    expect(eloExpected(1500, 1500)).toBeGreaterThan(0.5);
    const elo = computeLeagueElo([
      { home_id: 1, away_id: 2, home_goals: 2, away_goals: 0 },
      { home_id: 2, away_id: 1, home_goals: 0, away_goals: 1 },
    ]);
    expect(elo.get(1)!).toBeGreaterThan(1500);
    expect(elo.get(2)!).toBeLessThan(1500);
    expect(elo.get(1)! + elo.get(2)!).toBeCloseTo(3000, 6);
  });
});

describe('partidos de referencia', () => {
  it('Tigres 3–0 Pumas: favorito claro, over 2.5 probable, marcador probable a favor del local', () => {
    const r = analyzeFixture(tigresPumas);
    expect(r.lambda_home).toBeGreaterThan(1.9);
    expect(r.lambda_away).toBeLessThan(1.0);
    const home = find(r.outcomes, '1x2', 'home');
    expect(home.prob).toBeGreaterThan(0.58);
    expect(home.prob).toBeLessThan(0.82);
    expect(find(r.outcomes, 'totals', 'over', 2.5).prob).toBeGreaterThan(0.5);
    expect(r.scores[0].home).toBeGreaterThan(r.scores[0].away);
    // 1X2 suma 1
    const sum = find(r.outcomes, '1x2', 'home').prob + find(r.outcomes, '1x2', 'draw').prob + find(r.outcomes, '1x2', 'away').prob;
    expect(sum).toBeCloseTo(1, 6);
    // Jugadores: Gignac es el goleador más probable y aparece en tiros a puerta
    const scorers = r.outcomes.filter((o) => o.market === 'scorer');
    expect(scorers.length).toBeGreaterThan(0);
    expect(scorers[0].player_name).toBe('A. Gignac');
    expect(scorers[0].prob).toBeGreaterThan(0.3);
    expect(r.outcomes.some((o) => o.market === 'player_sot' && o.player_id === 10 && o.line === 0.5)).toBe(true);
    // Tarjetas con árbitro estricto: over 4.5 razonable
    expect(find(r.outcomes, 'cards', 'over', 4.5).prob).toBeGreaterThan(0.4);
  });

  it('Liverpool 1–1 Arsenal: parejo, empate con peso, under 2.5 competitivo', () => {
    const r = analyzeFixture(liverpoolArsenal);
    const h = find(r.outcomes, '1x2', 'home').prob;
    const a = find(r.outcomes, '1x2', 'away').prob;
    const d = find(r.outcomes, '1x2', 'draw').prob;
    expect(Math.abs(h - a)).toBeLessThan(0.25);
    expect(d).toBeGreaterThan(0.2);
    expect(find(r.outcomes, 'totals', 'under', 2.5).prob).toBeGreaterThan(0.4);
    // AH 0 (empate = push): probabilidades condicionadas suman 1
    const ah0h = find(r.outcomes, 'ah', 'ah_home', 0);
    const ah0a = r.outcomes.find((o) => o.market === 'ah' && o.selection === 'ah_away' && Math.abs((o.line ?? 1) - 0) < 1e-9)!;
    expect(ah0h.prob + ah0a.prob).toBeCloseTo(1, 6);
    expect(ah0h.push).toBeCloseTo(d, 6);
    // Mitades: 1T con menos goles que 2T
    expect(find(r.outcomes, 'ht', 'ht_over', 1.5).prob).toBeLessThan(find(r.outcomes, '2h', '2h_over', 1.5).prob);
  });

  it('Cusco 1–4 Universitario: visitante favorito, ambos anotan y over probables', () => {
    const r = analyzeFixture(cuscoUniversitario);
    expect(find(r.outcomes, '1x2', 'away').prob).toBeGreaterThan(find(r.outcomes, '1x2', 'home').prob);
    expect(r.lambda_away).toBeGreaterThan(r.lambda_home);
    expect(find(r.outcomes, 'team_totals', 'away_over', 1.5).prob).toBeGreaterThan(0.5);
    expect(find(r.outcomes, 'totals', 'over', 2.5).prob).toBeGreaterThan(0.5);
    expect(find(r.outcomes, 'dc', 'X2').prob).toBeGreaterThan(0.7);
  });
});

describe('ventaja y sello', () => {
  const quotes: OddsQuote[] = [
    { bookmaker: 'A', market: '1x2', selection: 'home', line: null, price: 1.72 },
    { bookmaker: 'A', market: '1x2', selection: 'draw', line: null, price: 3.8 },
    { bookmaker: 'A', market: '1x2', selection: 'away', line: null, price: 4.6 },
    { bookmaker: 'B', market: '1x2', selection: 'home', line: null, price: 1.68 },
    { bookmaker: 'B', market: '1x2', selection: 'draw', line: null, price: 3.9 },
    { bookmaker: 'B', market: '1x2', selection: 'away', line: null, price: 4.4 },
    { bookmaker: 'A', market: 'totals', selection: 'over', line: 2.5, price: 1.85 },
    { bookmaker: 'A', market: 'totals', selection: 'under', line: 2.5, price: 1.95 },
  ];

  it('quita el margen y usa la mejor cuota entre casas', () => {
    const priced = priceOutcomes([{ market: '1x2', selection: 'home', line: null, prob: 0.61 }, { market: '1x2', selection: 'draw', line: null, prob: 0.22 }, { market: '1x2', selection: 'away', line: null, prob: 0.17 }], quotes);
    const home = priced[0];
    expect(home.best_price).toBe(1.72);
    expect(home.best_bookmaker).toBe('A');
    const sum = 1 / 1.72 + 1 / 3.9 + 1 / 4.6;
    expect(home.implied_prob).toBeCloseTo(1 / 1.72 / sum, 6);
    expect(home.edge).toBeCloseTo(0.61 - 1 / 1.72 / sum, 6);
    // Sin cuota → sello baja y ventaja null
    const noOdds = priceOutcomes([{ market: 'corners', selection: 'over', line: 9.5, prob: 0.7 }], quotes)[0];
    expect(noOdds.edge).toBeNull();
    expect(noOdds.sello).toBe('baja');
  });

  it('reglas del sello', () => {
    expect(sello(0.66, 0.09)).toBe('alta');
    expect(sello(0.66, 0.07)).toBe('media');
    expect(sello(0.56, 0.05)).toBe('media');
    expect(sello(0.54, 0.2)).toBe('baja');
    expect(sello(0.9, null)).toBe('baja');
  });

  it('predictFixture entrega pick principal con sello', () => {
    const { priced } = predictFixture(tigresPumas, quotes);
    const pick = topPick(priced);
    expect(pick).not.toBeNull();
    expect(['alta', 'media', 'baja']).toContain(pick!.sello);
    expect(priced.filter((p) => p.market === '1x2').every((p) => p.best_price !== null)).toBe(true);
  });
});

describe('combinadas', () => {
  const mk = (fixture_id: number, prob: number, edge = 0.06, price = 1.6) => ({ fixture_id, market: '1x2', selection: 'home', line: null, prob, price, edge, sello: 'media' as const });

  it('nunca repite partido y muestra probabilidad conjunta', () => {
    const combos = buildCombos([mk(1, 0.7), mk(1, 0.9, 0.2), mk(2, 0.68), mk(3, 0.66), mk(4, 0.6), mk(5, 0.5, 0.3)]);
    expect(combos.segura).not.toBeNull();
    expect(combos.segura!.selections.map((s) => s.fixture_id)).toEqual([1, 2]);
    expect(combos.segura!.selections[0].prob).toBe(0.9); // la de más ventaja del partido 1
    expect(combos.segura!.jointProb).toBeCloseTo(0.9 * 0.68, 6);
    expect(new Set(combos.ambiciosa!.selections.map((s) => s.fixture_id)).size).toBe(4);
    // prob 0.5 no califica (umbral 55%)
    expect(combos.ambiciosa!.selections.some((s) => s.fixture_id === 5)).toBe(false);
  });

  it('devuelve null si no alcanza el umbral de probabilidad conjunta', () => {
    const combos = buildCombos([mk(1, 0.56), mk(2, 0.56)]);
    expect(combos.segura).toBeNull(); // 0.31 < 0.45
    expect(combos.equilibrada).toBeNull();
  });
});

describe('lectura de respaldo', () => {
  it('≤5 frases, sin palabras prohibidas', () => {
    const text = lecturaFallback(
      {
        home: 'Tigres', away: 'Pumas', league: 'Liga MX', homeForm: 'WWDWW', awayForm: 'LLLDW', homeGoalsPerGame: 2.0, awayGoalsPerGame: 0.8, homeXg: 1.8, awayXg: 0.9,
        homeMissing: 0, awayMissing: 2, probHome: 0.61, probDraw: 0.22, probAway: 0.17, probOver25: 0.58, topMarketLabel: 'Gana Tigres', topMarketProb: 0.61, topMarketPrice: 1.72, topMarketEdge: 0.06, sello: 'baja',
      },
      'es',
    );
    expect(text.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 1).length).toBeLessThanOrEqual(5);
    expect(/garantizad|segura|fija/i.test(text)).toBe(false);
    expect(text).toContain('1.72');
  });
});
