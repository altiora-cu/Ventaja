/** Prompt y parser (puros, testeables) de la carga de marcadores por búsqueda web. */

export const WEB_SCORES_MAX_TOKENS = 400;
export const WEB_SCORES_TEMPERATURE = 0;
export const WEB_SCORES_SEARCH_MAX_USES = 2;
const MAX_GOALS = 15;

export interface WebScoreFacts {
  home: string;
  away: string;
  league: string;
  /** Fecha prevista del partido, ISO. */
  kickoffIso: string;
}

export type WebScoreStatus = 'FT' | 'PST' | 'CANC';

export interface WebScore {
  status: WebScoreStatus;
  home_goals: number | null;
  away_goals: number | null;
  /** Fecha real en que se jugó, AAAA-MM-DD, si la encontró. */
  played_on: string | null;
  sources: string[];
}

export const WEB_SCORES_SYSTEM = `Eres el verificador de resultados de Ventaja, una sala de análisis estadístico de fútbol.
Te damos un partido que debería haberse jugado hace unos días y no tenemos su marcador. Búscalo en la web (máximo 2 búsquedas) y devuelve el resultado FINAL (tiempo reglamentario más añadido; sin prórroga ni penales).
Reglas:
- Solo informa un marcador si lo confirmas con claridad en al menos una fuente fiable (web oficial de la liga, ESPN, Flashscore, SofaScore, prensa deportiva reconocida). Si dos fuentes se contradicen, o solo encuentras pronósticos o alineaciones, responde "unknown".
- Si el partido fue aplazado, suspendido o cancelado, dilo con "PST" o "CANC".
- Cuidado con confundir el partido de ida con el de vuelta, o con otra temporada: comprueba equipos, competición y fecha aproximada.
Responde SOLO con un JSON válido, sin texto alrededor:
{"status":"FT"|"PST"|"CANC"|"unknown","home_goals":<entero o null>,"away_goals":<entero o null>,"played_on":"AAAA-MM-DD" o null,"confidence":"alta"|"media"|"baja","sources":["https://..."]}
"confidence" es "alta" solo si el marcador aparece explícito en la fuente para este partido exacto.`;

export function webScoresUserMessage(f: WebScoreFacts): string {
  return `Partido: ${f.home} (local) vs ${f.away} (visitante)\nCompetición: ${f.league}\nFecha prevista: ${f.kickoffIso.slice(0, 10)} (puede haberse movido uno o dos días)\n¿Cuál fue el resultado final?`;
}

/** Acepta solo respuestas con confianza alta y al menos una fuente; devuelve null en cualquier otro caso. */
export function parseWebScore(text: string): WebScore | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.confidence !== 'alta') return null;
  const sources = Array.isArray(o.sources) ? o.sources.filter((s): s is string => typeof s === 'string' && /^https?:\/\//.test(s)).slice(0, 3) : [];
  if (!sources.length) return null;
  const played_on = typeof o.played_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.played_on) ? o.played_on : null;
  if (o.status === 'PST' || o.status === 'CANC') return { status: o.status, home_goals: null, away_goals: null, played_on, sources };
  if (o.status !== 'FT') return null;
  const hg = Number(o.home_goals);
  const ag = Number(o.away_goals);
  if (!Number.isInteger(hg) || !Number.isInteger(ag) || hg < 0 || ag < 0 || hg > MAX_GOALS || ag > MAX_GOALS) return null;
  return { status: 'FT', home_goals: hg, away_goals: ag, played_on, sources };
}

/** La fecha encontrada debe estar a ≤ `days` de la prevista: evita cargar el partido de otra jornada. */
export function playedNearKickoff(score: WebScore, kickoffIso: string, days = 4): boolean {
  if (!score.played_on) return true;
  const delta = Math.abs(new Date(`${score.played_on}T12:00:00Z`).getTime() - new Date(kickoffIso).getTime());
  return delta <= days * 86_400_000;
}
