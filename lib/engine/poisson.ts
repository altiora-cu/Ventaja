/** Distribuciones discretas usadas por el motor. Funciones puras. */

const factCache: number[] = [1];
function factorial(n: number): number {
  if (factCache[n] !== undefined) return factCache[n];
  for (let i = factCache.length; i <= n; i++) factCache[i] = factCache[i - 1] * i;
  return factCache[n];
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0) return 0;
  // Forma logarítmica para estabilidad numérica
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** P(X ≤ k) */
export function poissonCdf(k: number, lambda: number): number {
  let s = 0;
  for (let i = 0; i <= Math.floor(k); i++) s += poissonPmf(i, lambda);
  return Math.min(1, s);
}

/** P(X > line) para líneas .5 (line=2.5 → P(X ≥ 3)). */
export function poissonOver(line: number, lambda: number): number {
  return 1 - poissonCdf(Math.floor(line), lambda);
}

/**
 * Binomial negativa parametrizada por media μ y dispersión k (var = μ + μ²/k).
 * Usada para tarjetas (más dispersas que Poisson).
 */
export function negBinPmf(x: number, mu: number, k: number): number {
  if (mu <= 0) return x === 0 ? 1 : 0;
  const p = k / (k + mu);
  // log Γ(x+k) − log Γ(k) − log x! + k log p + x log(1−p)
  const logCoef = lgamma(x + k) - lgamma(k) - lgamma(x + 1);
  return Math.exp(logCoef + k * Math.log(p) + x * Math.log(1 - p));
}

export function negBinOver(line: number, mu: number, k: number): number {
  let s = 0;
  for (let i = 0; i <= Math.floor(line); i++) s += negBinPmf(i, mu, k);
  return Math.max(0, 1 - s);
}

/** Lanczos log-gamma. */
export function lgamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export { factorial };
