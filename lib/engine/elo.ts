/** Elo por liga. K=20, ventaja local +60. */
export const ELO_K = 20;
export const ELO_HOME_ADV = 60;
export const ELO_BASE = 1500;

export function eloExpected(home: number, away: number, homeAdv = ELO_HOME_ADV): number {
  return 1 / (1 + Math.pow(10, (away - (home + homeAdv)) / 400));
}

/** Devuelve nuevos ratings tras un partido. result: goles local/visita. */
export function eloUpdate(home: number, away: number, homeGoals: number, awayGoals: number, k = ELO_K): { home: number; away: number } {
  const expected = eloExpected(home, away);
  const actual = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  // Multiplicador por margen (suave): 1, 1.5, 1.75, 1.875...
  const diff = Math.abs(homeGoals - awayGoals);
  const margin = diff <= 1 ? 1 : diff === 2 ? 1.5 : 1.75 + (diff - 3) * 0.125;
  const delta = k * margin * (actual - expected);
  return { home: home + delta, away: away - delta };
}

/**
 * Recalcula Elo de una liga a partir de partidos terminados en orden cronológico.
 */
export function computeLeagueElo(
  matches: Array<{ home_id: number; away_id: number; home_goals: number; away_goals: number }>,
  base = ELO_BASE,
): Map<number, number> {
  const elo = new Map<number, number>();
  for (const m of matches) {
    const h = elo.get(m.home_id) ?? base;
    const a = elo.get(m.away_id) ?? base;
    const upd = eloUpdate(h, a, m.home_goals, m.away_goals);
    elo.set(m.home_id, upd.home);
    elo.set(m.away_id, upd.away);
  }
  return elo;
}
