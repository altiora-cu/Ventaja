import { describe, expect, it } from 'vitest';
import { summarizePlays } from './play-stats';

describe('summarizePlays', () => {
  it('devuelve ceros y porcentajes vacíos sin jugadas', () => {
    expect(summarizePlays([])).toEqual({ total: 0, pending: 0, decided: 0, hits: 0, misses: 0, voids: 0, hitRate: null, units: 0, roi: null });
  });

  it('calcula el porcentaje de acierto sobre las jugadas decididas', () => {
    const s = summarizePlays([
      { result: 'acierto', units: 0.8 },
      { result: 'acierto', units: 1.1 },
      { result: 'fallo', units: -1 },
      { result: 'nulo', units: 0 },
      { result: null, units: 0 },
    ]);
    expect(s.total).toBe(5);
    expect(s.pending).toBe(1);
    expect(s.decided).toBe(3);
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.voids).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3);
    expect(s.units).toBe(0.9);
    expect(s.roi).toBeCloseTo(0.3);
  });

  it('no da porcentaje cuando todas las jugadas siguen pendientes', () => {
    const s = summarizePlays([{ result: null, units: 0 }]);
    expect(s.hitRate).toBeNull();
    expect(s.roi).toBeNull();
  });

  it('acepta unidades que llegan como texto desde Postgres', () => {
    const s = summarizePlays([{ result: 'acierto', units: '0.65' as unknown as number }]);
    expect(s.units).toBe(0.65);
  });
});
