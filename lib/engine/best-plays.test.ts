import { describe, expect, it } from 'vitest';
import { bestPlays, riskLevel, SAFE_MIN_PROB, toPlayCandidate, type PlayCandidate } from './best-plays';

function cand(over: Partial<PlayCandidate>): PlayCandidate {
  return { id: 1, market: 'totals', selection: 'under', line: 2.5, player_id: null, prob: 0.7, best_price: 1.6, edge: 0.08, sello: 'alta', ...over };
}

describe('bestPlays', () => {
  it('devuelve vacío cuando ninguna selección cumple el umbral', () => {
    const rows = [cand({ prob: 0.5, edge: 0.1 }), cand({ id: 2, prob: 0.8, edge: 0.01 }), cand({ id: 3, prob: 0.8, edge: null })];
    expect(bestPlays(rows)).toEqual([]);
  });

  it('descarta jugadas arriesgadas aunque tengan ventaja', () => {
    const risky = cand({ prob: SAFE_MIN_PROB - 0.01, edge: 0.2 });
    expect(bestPlays([risky])).toEqual([]);
  });

  it('descarta selecciones sin cuota y el marcador exacto', () => {
    const rows = [cand({ best_price: null }), cand({ id: 2, market: 'correct_score', selection: '1-0', line: null })];
    expect(bestPlays(rows)).toEqual([]);
  });

  it('deja una sola jugada por mercado: la de mayor probabilidad', () => {
    const rows = [cand({ id: 1, line: 2.5, prob: 0.66 }), cand({ id: 2, line: 3.5, prob: 0.82 }), cand({ id: 3, market: '1x2', selection: 'home', line: null, prob: 0.7 })];
    const out = bestPlays(rows);
    expect(out.map((p) => p.id)).toEqual([2, 3]);
  });

  it('ordena por probabilidad y respeta el máximo', () => {
    const markets = ['1x2', 'dc', 'totals', 'btts', 'ah', 'team_totals'];
    const rows = markets.map((market, i) => cand({ id: i + 1, market, prob: 0.62 + i * 0.03 }));
    const out = bestPlays(rows, 3);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.id)).toEqual([6, 5, 4]);
  });

  it('no modifica la lista recibida', () => {
    const rows = [cand({ id: 1, prob: 0.62 }), cand({ id: 2, market: 'btts', prob: 0.9 })];
    const copy = structuredClone(rows);
    bestPlays(rows);
    expect(rows).toEqual(copy);
  });
});

describe('riskLevel', () => {
  it('clasifica el riesgo según la probabilidad', () => {
    expect(riskLevel(0.75)).toBe('bajo');
    expect(riskLevel(0.7)).toBe('bajo');
    expect(riskLevel(0.62)).toBe('medio');
    expect(riskLevel(0.5)).toBe('alto');
  });
});

describe('toPlayCandidate', () => {
  it('convierte a número los valores que la base de datos devuelve como texto', () => {
    const row = { id: 7, fixture_id: 1, market: 'totals', selection: 'over', line: '2.5', player_id: null, player_name: null, prob: '0.71', best_price: '1.8', edge: '0.09', sello: 'alta' } as unknown as Parameters<typeof toPlayCandidate>[0];
    expect(toPlayCandidate(row)).toMatchObject({ id: 7, line: 2.5, prob: 0.71, best_price: 1.8, edge: 0.09 });
  });

  it('conserva los nulos de línea, cuota y ventaja', () => {
    const row = { id: 8, fixture_id: 1, market: '1x2', selection: 'home', line: null, player_id: null, player_name: null, prob: 0.5, best_price: null, edge: null, sello: 'baja' } as unknown as Parameters<typeof toPlayCandidate>[0];
    expect(toPlayCandidate(row)).toMatchObject({ line: null, best_price: null, edge: null });
  });
});
