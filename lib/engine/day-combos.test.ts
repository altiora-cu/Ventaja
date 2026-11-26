import { describe, expect, it } from 'vitest';
import { dreamCombo, mostProbableCombo, type ComboSelection } from './combos';

const s = (fixture_id: number, market: string, selection: string, prob: number, price: number): ComboSelection => ({ fixture_id, market, selection, line: null, prob, price, edge: prob - 1 / price, sello: 'media' });

describe('mostProbableCombo', () => {
  it('toma la jugada más probable de cada partido y las dos mejores', () => {
    const c = mostProbableCombo([s(1, '1x2', 'home', 0.72, 1.45), s(1, 'totals', 'under', 0.65, 1.6), s(2, 'dc', '1X', 0.68, 1.3), s(3, 'btts', 'no', 0.62, 1.7)]);
    expect(c!.selections.map((x) => x.fixture_id)).toEqual([1, 2]);
    expect(c!.jointProb).toBeCloseTo(0.72 * 0.68);
    expect(c!.totalPrice).toBeCloseTo(1.45 * 1.3);
  });

  it('añade una tercera solo si la conjunta sigue en 50% o más', () => {
    const three = mostProbableCombo([s(1, '1x2', 'home', 0.85, 1.25), s(2, 'dc', '1X', 0.82, 1.25), s(3, 'totals', 'under', 0.8, 1.3)]);
    expect(three!.selections).toHaveLength(3);
    const two = mostProbableCombo([s(1, '1x2', 'home', 0.7, 1.4), s(2, 'dc', '1X', 0.7, 1.4), s(3, 'totals', 'under', 0.7, 1.4)]);
    expect(two!.selections).toHaveLength(2);
  });

  it('descarta cuotas mínimas, probabilidades bajas, mercados raros y devuelve null sin dos partidos', () => {
    expect(mostProbableCombo([s(1, '1x2', 'home', 0.95, 1.05), s(2, 'ht', 'ht_over', 0.9, 1.3), s(3, 'btts', 'no', 0.55, 1.8), s(4, 'dc', '1X', 0.7, 1.3)])).toBeNull();
  });
});

describe('dreamCombo', () => {
  it('seis partidos distintos, la cuota más alta entre las jugadas plausibles', () => {
    const cands = [1, 2, 3, 4, 5, 6, 7].flatMap((f) => [s(f, '1x2', 'home', 0.45, 2 + f / 10), s(f, 'totals', 'over', 0.6, 1.6), s(f, '1x2', 'away', 0.1, 9)]);
    const c = dreamCombo(cands)!;
    expect(c.selections).toHaveLength(6);
    expect(new Set(c.selections.map((x) => x.fixture_id)).size).toBe(6);
    expect(c.selections.every((x) => x.prob >= 0.4)).toBe(true);
    expect(c.selections[0].fixture_id).toBe(7);
    expect(c.totalPrice).toBeGreaterThan(60);
    expect(c.jointProb).toBeCloseTo(0.45 ** 6);
  });

  it('prefiere en cada partido la jugada con ventaja sobre la cuota', () => {
    const cands = [1, 2, 3, 4, 5, 6].flatMap((f) => [s(f, '1x2', 'home', 0.41, 2.3), s(f, 'btts', 'yes', 0.6, 1.9)]);
    expect(dreamCombo(cands)!.selections.every((x) => x.market === 'btts')).toBe(true);
  });

  it('null si no hay seis partidos', () => {
    expect(dreamCombo([1, 2, 3, 4, 5].map((f) => s(f, '1x2', 'home', 0.5, 2)))).toBeNull();
  });
});
