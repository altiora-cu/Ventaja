import { scoreMatrix, sumWhere } from './dixon-coles';
import type { ModelOutcome } from './types';

export const HT_SHARE_DEFAULT = 0.44;
export const HALF_TOTAL_LINES = [0.5, 1.5];

/**
 * Mitades: reparte λ en 44% primer tiempo / 56% segundo (ajustable por liga) y
 * calcula resultado y O/U por mitad con la misma distribución.
 */
export function halfMarkets(lambdaHome: number, lambdaAway: number, htShare = HT_SHARE_DEFAULT): ModelOutcome[] {
  const out: ModelOutcome[] = [];
  const halves: Array<{ key: 'ht' | '2h'; share: number }> = [
    { key: 'ht', share: htShare },
    { key: '2h', share: 1 - htShare },
  ];
  for (const { key, share } of halves) {
    const m = scoreMatrix(lambdaHome * share, lambdaAway * share, -0.05, 5);
    out.push({ market: key, selection: `${key}_home`, line: null, prob: sumWhere(m, (h, a) => h > a) });
    out.push({ market: key, selection: `${key}_draw`, line: null, prob: sumWhere(m, (h, a) => h === a) });
    out.push({ market: key, selection: `${key}_away`, line: null, prob: sumWhere(m, (h, a) => h < a) });
    for (const line of HALF_TOTAL_LINES) {
      const over = sumWhere(m, (h, a) => h + a > line);
      out.push({ market: key, selection: `${key}_over`, line, prob: over });
      out.push({ market: key, selection: `${key}_under`, line, prob: 1 - over });
    }
  }
  return out;
}
