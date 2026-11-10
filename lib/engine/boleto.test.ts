import { describe, expect, it } from 'vitest';
import { boletoTotals } from './boleto';

describe('boletoTotals', () => {
  it('multiplica cuotas y probabilidades', () => {
    const t = boletoTotals([
      { fixtureId: 1, prob: 0.6, price: 1.5 },
      { fixtureId: 2, prob: 0.5, price: 2 },
    ]);
    expect(t.totalPrice).toBeCloseTo(3);
    expect(t.jointProb).toBeCloseTo(0.3);
    expect(t.canCombo).toBe(true);
    expect(t.sameFixture).toBe(false);
  });

  it('sin cuota en alguna jugada no hay cuota combinada', () => {
    const t = boletoTotals([
      { fixtureId: 1, prob: 0.6, price: 1.5 },
      { fixtureId: 2, prob: 0.5, price: null },
    ]);
    expect(t.totalPrice).toBeNull();
    expect(t.canCombo).toBe(true);
  });

  it('una sola jugada no se puede guardar como combinada', () => {
    const t = boletoTotals([{ fixtureId: 1, prob: 0.6, price: 1.5 }]);
    expect(t.totalPrice).toBeCloseTo(1.5);
    expect(t.canCombo).toBe(false);
  });

  it('dos jugadas del mismo partido bloquean la combinada', () => {
    const t = boletoTotals([
      { fixtureId: 1, prob: 0.6, price: 1.5 },
      { fixtureId: 1, prob: 0.5, price: 1.8 },
    ]);
    expect(t.sameFixture).toBe(true);
    expect(t.canCombo).toBe(false);
  });

  it('más de 8 jugadas no se guardan como combinada', () => {
    const legs = Array.from({ length: 9 }, (_, i) => ({ fixtureId: i + 1, prob: 0.9, price: 1.1 }));
    expect(boletoTotals(legs).canCombo).toBe(false);
    expect(boletoTotals([]).jointProb).toBe(0);
  });
});
