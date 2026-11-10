import { describe, expect, it } from 'vitest';
import { fmtMoney, monthlyRecord, payout, playMoney, streaks, summarizeMoney } from './money';

const play = (result: 'acierto' | 'fallo' | 'nulo' | null, units: number, stake: number | null, settled_at: string | null = '2026-11-01T12:00:00Z') => ({ result, units, stake, settled_at });

describe('money', () => {
  it('formatea dólares y soles', () => {
    expect(fmtMoney(12.5, 'USD')).toBe('$12.50');
    expect(fmtMoney(12.5, 'PEN')).toBe('S/ 12.50');
    expect(fmtMoney(-3, 'USD')).toBe('−$3.00');
    expect(fmtMoney(3, 'USD', 'es', true)).toBe('+$3.00');
  });

  it('convierte unidades en dinero y calcula el cobro', () => {
    expect(playMoney(0.85, 10)).toBe(8.5);
    expect(playMoney(-1, 25)).toBe(-25);
    expect(playMoney(1, null)).toBe(0);
    expect(payout(10, 1.85)).toBe(18.5);
    expect(payout(10, null)).toBeNull();
  });

  it('resume el balance solo con jugadas cerradas y con stake', () => {
    const s = summarizeMoney([play('acierto', 0.85, 10), play('fallo', -1, 10), play('nulo', 0, 10), play(null, 0, 10), play('acierto', 1, null)]);
    expect(s.staked).toBe(30);
    expect(s.balance).toBe(-1.5);
    expect(s.withoutStake).toBe(1);
  });

  it('calcula rachas en orden de cierre, ignorando nulas', () => {
    const r = streaks([
      play('acierto', 1, 10, '2026-11-01T00:00:00Z'),
      play('acierto', 1, 10, '2026-11-02T00:00:00Z'),
      play('nulo', 0, 10, '2026-11-03T00:00:00Z'),
      play('fallo', -1, 10, '2026-11-04T00:00:00Z'),
      play('fallo', -1, 10, '2026-11-05T00:00:00Z'),
      play('fallo', -1, 10, '2026-11-06T00:00:00Z'),
      play('acierto', 1, 10, '2026-11-07T00:00:00Z'),
    ]);
    expect(r.current).toBe(1);
    expect(r.bestWin).toBe(2);
    expect(r.worstLoss).toBe(3);
  });

  it('agrupa el registro por mes, del más reciente al más antiguo', () => {
    const rec = monthlyRecord([play('acierto', 0.9, 10, '2026-10-20T12:00:00Z'), play('fallo', -1, 10, '2026-11-02T12:00:00Z'), play('acierto', 0.5, 20, '2026-11-05T12:00:00Z')]);
    expect(rec.map((r) => r.month)).toEqual(['2026-11', '2026-10']);
    expect(rec[0]).toMatchObject({ hits: 1, misses: 1, voids: 0, units: -0.5, balance: 0 });
    expect(rec[1].balance).toBe(9);
  });
});
