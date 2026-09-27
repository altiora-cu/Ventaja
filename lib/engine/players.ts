import { poissonOver } from './poisson';
import type { ModelOutcome, PlayerInput } from './types';

export const MINUTES_STARTER = 85;
export const MINUTES_SUB = 25;
export const PLAYER_SOT_LINES = [0.5, 1.5];
/** Conversión típica de tiro a puerta → gol cuando no hay xG del jugador. */
export const SOT_CONVERSION = 0.3;

/** Minutos esperados: titular 85, suplente 25. Si no hay alineación, usa la proporción de titularidades. */
export function expectedMinutes(p: PlayerInput): number {
  if (p.starter === true) return MINUTES_STARTER;
  if (p.starter === false) return MINUTES_SUB;
  if (p.appearances <= 0) return 0;
  const startRate = p.lineups / p.appearances;
  return startRate * MINUTES_STARTER + (1 - startRate) * MINUTES_SUB * 0.6;
}

export function per90(value: number | null, minutes: number): number {
  if (!value || minutes <= 0) return 0;
  return (value / minutes) * 90;
}

/** xG/90 estimado del jugador: usa xG real si existe, si no mezcla goles/90 con tiros a puerta/90 × conversión. */
export function playerXg90(p: PlayerInput): number {
  if (p.xg !== null && p.xg !== undefined && p.minutes > 0) return per90(p.xg, p.minutes);
  const g90 = per90(p.goals, p.minutes);
  const sot90 = per90(p.sot, p.minutes);
  // Shrinkage hacia los tiros (más estables que los goles)
  return 0.5 * g90 + 0.5 * sot90 * SOT_CONVERSION;
}

export interface TeamContext {
  team_id: number;
  lambda: number;
}

/**
 * Tiros a puerta (O/U 0.5, 1.5) y goleador probable (top 5 con %).
 * Goleador: xG_jugador/90 × min_esperados / (xG_equipo/90) × λ_equipo → P(≥1 gol).
 */
export function playerMarkets(players: PlayerInput[], teams: TeamContext[]): ModelOutcome[] {
  const out: ModelOutcome[] = [];
  const scorers: Array<ModelOutcome & { mu: number }> = [];

  for (const team of teams) {
    const squad = players.filter((p) => p.team_id === team.team_id && p.minutes >= 90);
    if (!squad.length) continue;

    // xG_equipo/90 = suma de xG/90 de la plantilla ponderada por minutos esperados / 90
    const teamXg90 = squad.reduce((s, p) => s + playerXg90(p) * (expectedMinutes(p) / 90), 0) || 1;

    // Candidatos: los que más juegan
    const candidates = [...squad].sort((a, b) => expectedMinutes(b) - expectedMinutes(a) || b.minutes - a.minutes).slice(0, 14);

    for (const p of candidates) {
      const mins = expectedMinutes(p);
      if (mins < 15) continue;
      const sot90 = per90(p.sot, p.minutes);
      const muSot = sot90 * (mins / 90);
      if (muSot > 0.15) {
        for (const line of PLAYER_SOT_LINES) {
          const over = poissonOver(line, muSot);
          out.push({ market: 'player_sot', selection: 'over', line, prob: over, player_id: p.id, player_name: p.name });
        }
      }
      const shareXg = (playerXg90(p) * (mins / 90)) / teamXg90;
      const muGoals = shareXg * team.lambda;
      if (muGoals > 0.02) {
        scorers.push({ market: 'scorer', selection: 'scores', line: null, prob: 1 - Math.exp(-muGoals), player_id: p.id, player_name: p.name, mu: muGoals });
      }
    }
  }

  scorers.sort((a, b) => b.prob - a.prob);
  for (const s of scorers.slice(0, 5)) {
    const { mu: _mu, ...rest } = s;
    void _mu;
    out.push(rest);
  }
  return out;
}
