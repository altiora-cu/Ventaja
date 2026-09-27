import { sumWhere } from './dixon-coles';
import type { ModelOutcome } from './types';

export const TOTAL_LINES = [1.5, 2.5, 3.5];
export const TEAM_TOTAL_LINES = [0.5, 1.5];
export const AH_LINES = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];

/** Mercados derivados de la matriz de marcadores (tiempo completo). */
export function fullTimeMarkets(matrix: number[][]): ModelOutcome[] {
  const out: ModelOutcome[] = [];
  const pHome = sumWhere(matrix, (h, a) => h > a);
  const pDraw = sumWhere(matrix, (h, a) => h === a);
  const pAway = sumWhere(matrix, (h, a) => h < a);

  out.push({ market: '1x2', selection: 'home', line: null, prob: pHome });
  out.push({ market: '1x2', selection: 'draw', line: null, prob: pDraw });
  out.push({ market: '1x2', selection: 'away', line: null, prob: pAway });

  out.push({ market: 'dc', selection: '1X', line: null, prob: pHome + pDraw });
  out.push({ market: 'dc', selection: '12', line: null, prob: pHome + pAway });
  out.push({ market: 'dc', selection: 'X2', line: null, prob: pDraw + pAway });

  for (const line of TOTAL_LINES) {
    const over = sumWhere(matrix, (h, a) => h + a > line);
    out.push({ market: 'totals', selection: 'over', line, prob: over });
    out.push({ market: 'totals', selection: 'under', line, prob: 1 - over });
  }

  for (const line of TEAM_TOTAL_LINES) {
    const hOver = sumWhere(matrix, (h) => h > line);
    const aOver = sumWhere(matrix, (_h, a) => a > line);
    out.push({ market: 'team_totals', selection: 'home_over', line, prob: hOver });
    out.push({ market: 'team_totals', selection: 'home_under', line, prob: 1 - hOver });
    out.push({ market: 'team_totals', selection: 'away_over', line, prob: aOver });
    out.push({ market: 'team_totals', selection: 'away_under', line, prob: 1 - aOver });
  }

  const btts = sumWhere(matrix, (h, a) => h > 0 && a > 0);
  out.push({ market: 'btts', selection: 'yes', line: null, prob: btts });
  out.push({ market: 'btts', selection: 'no', line: null, prob: 1 - btts });

  for (const line of AH_LINES) {
    // Local con hándicap `line`: gana si h + line > a; push si h + line === a.
    const win = sumWhere(matrix, (h, a) => h + line > a + 1e-9);
    const push = sumWhere(matrix, (h, a) => Math.abs(h + line - a) < 1e-9);
    const lose = 1 - win - push;
    const denom = win + lose;
    // Probabilidad condicionada a que no haya push (el stake se devuelve en push).
    out.push({ market: 'ah', selection: 'ah_home', line, prob: denom > 0 ? win / denom : 0, push });
    out.push({ market: 'ah', selection: 'ah_away', line: -line, prob: denom > 0 ? lose / denom : 0, push });
  }

  return out;
}
