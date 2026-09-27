import type { Fixture, PickResult } from '@/lib/db/types';

export interface SettleInput {
  market: string;
  selection: string;
  line: number | null;
  player_id: number | null;
}

/**
 * Decide si un pick acertó con el resultado real. Devuelve null si faltan datos para cerrarlo.
 * Función pura con tests.
 */
export function settleOutcome(p: SettleInput, f: Fixture): PickResult | null {
  if (f.home_goals === null || f.away_goals === null) return null;
  const h = f.home_goals;
  const a = f.away_goals;
  const total = h + a;
  const overUnder = (value: number, line: number, sel: string): PickResult => {
    if (value === line) return 'nulo';
    const over = value > line;
    return (sel.endsWith('over') ? over : !over) ? 'acierto' : 'fallo';
  };
  const hit = (b: boolean): PickResult => (b ? 'acierto' : 'fallo');

  switch (p.market) {
    case '1x2':
      return hit(p.selection === 'home' ? h > a : p.selection === 'away' ? a > h : h === a);
    case 'dc':
      return hit(p.selection === '1X' ? h >= a : p.selection === 'X2' ? a >= h : h !== a);
    case 'totals':
      return p.line === null ? null : overUnder(total, p.line, p.selection);
    case 'team_totals': {
      if (p.line === null) return null;
      const side = p.selection.startsWith('home') ? h : a;
      return overUnder(side, p.line, p.selection);
    }
    case 'btts':
      return hit((h > 0 && a > 0) === (p.selection === 'yes'));
    case 'ah': {
      if (p.line === null) return null;
      // Línea desde la perspectiva de la selección
      const margin = p.selection === 'ah_home' ? h - a + p.line : a - h + p.line;
      if (Math.abs(margin) < 1e-9) return 'nulo';
      return hit(margin > 0);
    }
    case 'ht':
    case '2h': {
      if (f.ht_home_goals === null || f.ht_away_goals === null) return null;
      const hh = p.market === 'ht' ? f.ht_home_goals : h - f.ht_home_goals;
      const ha = p.market === 'ht' ? f.ht_away_goals : a - f.ht_away_goals;
      if (p.selection.endsWith('_over') || p.selection.endsWith('_under')) {
        return p.line === null ? null : overUnder(hh + ha, p.line, p.selection);
      }
      if (p.selection.endsWith('_home')) return hit(hh > ha);
      if (p.selection.endsWith('_away')) return hit(ha > hh);
      return hit(hh === ha);
    }
    case 'corners': {
      const c = f.stats?.corners;
      if (!c || p.line === null) return null;
      return overUnder(c.home + c.away, p.line, p.selection);
    }
    case 'cards': {
      const s = f.stats;
      if (!s || p.line === null) return null;
      const cards = s.yellow || s.red ? (s.yellow?.home ?? 0) + (s.yellow?.away ?? 0) + (s.red?.home ?? 0) + (s.red?.away ?? 0) : s.cards ? s.cards.home + s.cards.away : null;
      return cards === null ? null : overUnder(cards, p.line, p.selection);
    }
    case 'sot': {
      const s = f.stats?.sot;
      if (!s || p.line === null) return null;
      return overUnder(p.selection.startsWith('home') ? s.home : s.away, p.line, p.selection);
    }
    case 'player_sot': {
      const pl = f.stats?.players?.find((x) => x.player_id === p.player_id);
      if (!pl || p.line === null) return null;
      if (pl.minutes <= 0) return 'nulo';
      return overUnder(pl.sot, p.line, p.selection);
    }
    case 'scorer': {
      const pl = f.stats?.players?.find((x) => x.player_id === p.player_id);
      if (!f.stats?.players) return null;
      if (!pl || pl.minutes <= 0) return 'nulo';
      return hit(pl.goals > 0);
    }
    default:
      return null;
  }
}

/** Unidades con stake 1u a cuota cerrada. */
export function unitsFor(result: PickResult, price: number | null): number {
  if (result === 'nulo' || !price) return 0;
  return result === 'acierto' ? Math.round((price - 1) * 100) / 100 : -1;
}
