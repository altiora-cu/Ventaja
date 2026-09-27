import type { LeagueAverages, TeamInput } from './types';
import { clamp } from '@/lib/utils';

/** Pesos lineales 1.0 → 0.55 para los últimos 10 partidos (más reciente primero). */
export function recencyWeights(n: number): number[] {
  if (n <= 1) return [1];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(1 - (0.45 * i) / (n - 1));
  return out;
}

function weightedAvg(values: number[], weights: number[]): number | null {
  let s = 0;
  let w = 0;
  values.forEach((v, i) => {
    s += v * weights[i];
    w += weights[i];
  });
  return w > 0 ? s / w : null;
}

/**
 * xG ponderado de los últimos 10 (separado local/visita cuando hay muestra suficiente),
 * mezclado con la temporada para estabilidad. Devuelve goles esperados a favor y en contra por partido.
 */
export function teamRates(team: TeamInput, atHome: boolean, league: LeagueAverages): { attack: number; defense: number } {
  const split = atHome ? team.home : team.away;
  const leagueFor = atHome ? league.home_goals : league.away_goals;
  const leagueAgainst = atHome ? league.away_goals : league.home_goals;

  // Temporada (en la condición): usa xG si existe, si no goles.
  const seasonFor = split.played > 0 ? (split.xg ?? split.gf) / split.played : leagueFor;
  const seasonAgainst = split.played > 0 ? (split.xga ?? split.gc) / split.played : leagueAgainst;

  // Recientes: hasta 10, ponderados. Prefiere misma condición si hay ≥4 partidos; si no, todos.
  const sameCond = team.recent.filter((m) => m.home === atHome).slice(0, 10);
  const pool = (sameCond.length >= 4 ? sameCond : team.recent).slice(0, 10);
  const w = recencyWeights(pool.length);
  const recFor = weightedAvg(pool.map((m) => m.xg ?? m.gf), w);
  const recAgainst = weightedAvg(pool.map((m) => m.xga ?? m.gc), w);

  // Ajuste de condición cuando el pool mezcla local/visita: reescala al promedio de la condición.
  const condFactorFor = sameCond.length >= 4 ? 1 : leagueFor / ((league.home_goals + league.away_goals) / 2);
  const condFactorAgainst = sameCond.length >= 4 ? 1 : leagueAgainst / ((league.home_goals + league.away_goals) / 2);

  // Peso de lo reciente crece con la muestra (máx 0.6 con 10 partidos).
  const recWeight = clamp(pool.length / 10, 0, 1) * 0.6;
  const attackGoals = recFor === null ? seasonFor : recWeight * recFor * condFactorFor + (1 - recWeight) * seasonFor;
  const defenseGoals = recAgainst === null ? seasonAgainst : recWeight * recAgainst * condFactorAgainst + (1 - recWeight) * seasonAgainst;

  // Fuerzas relativas a la liga (1 = promedio). Acotadas para evitar extremos con poca muestra.
  const attack = clamp(attackGoals / leagueFor, 0.35, 2.6);
  const defense = clamp(defenseGoals / leagueAgainst, 0.35, 2.6);
  return { attack, defense };
}

/** Ajuste ±8% por bajas de titulares: −2% al ataque propio por titular ausente (máx 8%), +1% al rival. */
export function injuryFactors(missingHome: number, missingAway: number): { home: number; away: number } {
  const hLoss = Math.min(0.08, 0.02 * Math.max(0, missingHome));
  const aLoss = Math.min(0.08, 0.02 * Math.max(0, missingAway));
  return {
    home: (1 - hLoss) * (1 + aLoss / 2),
    away: (1 - aLoss) * (1 + hLoss / 2),
  };
}

/**
 * Empuje suave del Elo (la fuerza principal ya viene del xG): la razón λ_local/λ_visita
 * se multiplica por 10^(0.15·diff/400); con 200 puntos de diferencia ≈ +10% / −9%.
 */
export function eloFactor(eloHome: number, eloAway: number, homeAdv = 60): number {
  const diff = eloHome + homeAdv - eloAway;
  return Math.pow(10, (diff / 400) * 0.15);
}

export interface Lambdas {
  home: number;
  away: number;
  components: {
    attack_home: number;
    defense_home: number;
    attack_away: number;
    defense_away: number;
    injury_home: number;
    injury_away: number;
    elo: number;
  };
}

/**
 * λ_local = ataque_local × defensa_visita × media_liga_local
 * λ_visita = ataque_visita × defensa_local × media_liga_visita
 * con ajuste por bajas y empuje Elo.
 */
export function expectedGoals(home: TeamInput, away: TeamInput, league: LeagueAverages): Lambdas {
  const h = teamRates(home, true, league);
  const a = teamRates(away, false, league);
  const inj = injuryFactors(home.missing_starters, away.missing_starters);
  const elo = eloFactor(home.elo, away.elo);

  const lambdaHome = clamp(h.attack * a.defense * league.home_goals * inj.home * Math.sqrt(elo), 0.2, 4.5);
  const lambdaAway = clamp(a.attack * h.defense * league.away_goals * inj.away / Math.sqrt(elo), 0.2, 4.5);

  return {
    home: lambdaHome,
    away: lambdaAway,
    components: {
      attack_home: h.attack,
      defense_home: h.defense,
      attack_away: a.attack,
      defense_away: a.defense,
      injury_home: inj.home,
      injury_away: inj.away,
      elo,
    },
  };
}
