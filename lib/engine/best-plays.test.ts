import { describe, expect, it } from 'vitest';
import { bestPlays, rejectedByAi, riskLevel, SAFE_MIN_PROB, toPlayCandidate, type PlayCandidate } from './best-plays';

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

describe('rejectedByAi', () => {
  it('excluye de las mejores jugadas las que la revisión IA contradice', () => {
    const rows = [cand({ id: 1, market: 'totals', selection: 'under', line: 2.5, prob: 0.8 }), cand({ id: 2, market: '1x2', selection: 'home', line: null, prob: 0.7 })];
    const reviews = [
      { key: 'totals|under|2.5|', verdict: 'discrepa' as const, note: 'n', sello_modelo: 'alta' as const, sello_final: 'baja' as const },
      { key: '1x2|home||', verdict: 'cautela' as const, note: 'n', sello_modelo: 'alta' as const, sello_final: 'media' as const },
    ];
    const rejected = rejectedByAi(rows, reviews);
    expect([...rejected]).toEqual([1]);
    expect(bestPlays(rows, undefined, rejected).map((p) => p.id)).toEqual([2]);
  });

  it('sin revisión no excluye nada', () => {
    expect(rejectedByAi([cand({})], null).size).toBe(0);
  });
});

import { probablePlays } from './best-plays';

describe('probablePlays', () => {
  const c = (id: number, market: string, selection: string, prob: number, best_price: number | null, line: number | null = null) => ({ id, market, selection, line, player_id: null, prob, best_price, edge: best_price ? prob - 1 / best_price : null, sello: 'baja' as const });

  it('devuelve las más probables, una por mercado, aunque no tengan ventaja', () => {
    const out = probablePlays([c(1, '1x2', 'home', 0.58, 1.6), c(2, '1x2', 'draw', 0.22, 4), c(3, 'totals', 'under', 0.66, 1.45, 2.5), c(4, 'totals', 'over', 0.34, 2.6, 2.5), c(5, 'btts', 'no', 0.61, 1.7)]);
    expect(out.map((p) => p.id)).toEqual([3, 5, 1]);
  });

  it('descarta jugadas obvias: cuota mínima con precio, tope de probabilidad sin precio', () => {
    const out = probablePlays([c(1, 'totals', 'under', 0.95, 1.05, 4.5), c(2, 'dc', '1X', 0.9, null), c(3, 'btts', 'no', 0.62, null)]);
    expect(out.map((p) => p.id)).toEqual([3]);
  });

  it('prefiere las que tienen cuota y respeta el tope y los rechazos de la IA', () => {
    const list = [c(1, '1x2', 'home', 0.7, null), c(2, 'totals', 'under', 0.6, 1.6, 2.5), c(3, 'btts', 'no', 0.65, 1.5), c(4, 'dc', '1X', 0.8, 1.25)];
    expect(probablePlays(list).map((p) => p.id)).toEqual([4, 3, 2]);
    expect(probablePlays(list, 3, new Set([4])).map((p) => p.id)).toEqual([3, 2, 1]);
  });

  it('nada por debajo del 55%', () => {
    expect(probablePlays([c(1, '1x2', 'home', 0.5, 2)])).toEqual([]);
  });
});

describe('coherencia entre Mejores jugadas y Picks', () => {
  const c = (id: number, market: string, selection: string, prob: number, best_price: number | null) => ({ id, market, selection, line: null, player_id: null, prob, best_price, edge: best_price ? prob - 1 / best_price : null, sello: 'media' as const });

  it('una jugada con 57% y ventaja de 15% es mejor jugada, con riesgo alto', () => {
    const out = bestPlays([c(1, '1x2', 'home', 0.57, 2.38)]);
    expect(out.map((p) => p.id)).toEqual([1]);
    expect(riskLevel(0.57)).toBe('alto');
    expect(riskLevel(0.62)).toBe('medio');
  });

  it('las más probables solo salen de mercados principales', () => {
    const out = probablePlays([c(1, 'ht', 'ht_over', 0.84, null), c(2, '2h', '2h_over', 0.84, null), c(3, 'btts', 'no', 0.6, null)]);
    expect(out.map((p) => p.id)).toEqual([3]);
  });
});
