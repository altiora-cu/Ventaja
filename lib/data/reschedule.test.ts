import { describe, expect, it } from 'vitest';
import { findRescheduled } from './reschedule';

const ex = (id: number, external_id: string | null, kickoff: string, home_id = 1, away_id = 2) => ({ id, external_id, kickoff, home_id, away_id });

describe('findRescheduled', () => {
  it('reutiliza el partido huérfano del mismo cruce dentro de 7 días', () => {
    const existing = [ex(10, 'old', '2026-10-12T20:00:00Z')];
    const hit = findRescheduled({ home_id: 1, away_id: 2, kickoff: '2026-10-14T22:00:00Z' }, existing, new Set(['new']), new Set());
    expect(hit?.id).toBe(10);
  });

  it('no toca un partido que el proveedor sigue devolviendo con su id', () => {
    const existing = [ex(10, 'live', '2026-10-12T20:00:00Z')];
    expect(findRescheduled({ home_id: 1, away_id: 2, kickoff: '2026-10-14T22:00:00Z' }, existing, new Set(['live', 'new']), new Set())).toBeNull();
  });

  it('ignora cruces distintos, el partido de vuelta y fechas lejanas', () => {
    const existing = [ex(10, 'a', '2026-10-12T20:00:00Z', 2, 1), ex(11, 'b', '2026-09-01T20:00:00Z'), ex(12, 'c', '2026-10-12T20:00:00Z', 1, 3)];
    expect(findRescheduled({ home_id: 1, away_id: 2, kickoff: '2026-10-14T22:00:00Z' }, existing, new Set(), new Set())).toBeNull();
  });

  it('elige el más cercano en fecha y no reutiliza uno ya asignado en la corrida', () => {
    const existing = [ex(10, 'a', '2026-10-08T20:00:00Z'), ex(11, 'b', '2026-10-13T20:00:00Z')];
    const used = new Set<number>();
    const first = findRescheduled({ home_id: 1, away_id: 2, kickoff: '2026-10-14T22:00:00Z' }, existing, new Set(), used);
    expect(first?.id).toBe(11);
    used.add(11);
    expect(findRescheduled({ home_id: 1, away_id: 2, kickoff: '2026-10-14T22:00:00Z' }, existing, new Set(), used)?.id).toBe(10);
  });
});
