import { poissonPmf } from './poisson';
import type { ScoreProb } from './types';

export const MAX_GOALS = 6;
/** Corrección Dixon-Coles para marcadores bajos. Valor típico −0.13…−0.05. */
export const RHO_DEFAULT = -0.08;

export function tau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/**
 * Matriz de probabilidades de marcador [home][away] hasta MAX_GOALS por lado, normalizada.
 */
export function scoreMatrix(lambdaHome: number, lambdaAway: number, rho = RHO_DEFAULT, maxGoals = MAX_GOALS): number[][] {
  const m: number[][] = [];
  let total = 0;
  for (let h = 0; h <= maxGoals; h++) {
    m[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway) * tau(h, a, lambdaHome, lambdaAway, rho);
      m[h][a] = Math.max(0, p);
      total += m[h][a];
    }
  }
  for (let h = 0; h <= maxGoals; h++) for (let a = 0; a <= maxGoals; a++) m[h][a] /= total;
  return m;
}

export function topScores(matrix: number[][], n = 4): ScoreProb[] {
  const all: ScoreProb[] = [];
  matrix.forEach((row, h) => row.forEach((prob, a) => all.push({ home: h, away: a, prob })));
  return all.sort((x, y) => y.prob - x.prob).slice(0, n);
}

/** Suma de probabilidades que cumplen el predicado. */
export function sumWhere(matrix: number[][], pred: (h: number, a: number) => boolean): number {
  let s = 0;
  matrix.forEach((row, h) => row.forEach((p, a) => (pred(h, a) ? (s += p) : 0)));
  return s;
}
