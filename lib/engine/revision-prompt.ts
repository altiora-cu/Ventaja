import type { Sello } from '@/lib/db/types';

/**
 * Prompt fijo de la Revisión IA. La IA no calcula probabilidades: audita el pick del modelo
 * con el contexto disponible y solo puede BAJAR el sello, nunca subirlo.
 */
export const REVISION_MODEL = process.env.VENTAJA_AI_MODEL ?? 'claude-haiku-4-5';
export const REVISION_MAX_TOKENS = 400;
export const REVISION_TEMPERATURE = 0.2;

export const REVISION_SYSTEM = `Eres el revisor de riesgos de Ventaja, una sala de análisis estadístico de fútbol.
Recibes el pick principal que produjo un modelo Poisson/Dixon-Coles y el contexto del partido.
Tu trabajo NO es predecir el resultado ni cambiar probabilidades: es auditar si el contexto respalda o contradice el pick.
Responde SOLO con un JSON válido, sin texto alrededor, con esta forma exacta:
{"verdict":"concuerda"|"cautela"|"discrepa","risks":["...","..."],"note":"..."}
Reglas:
- "concuerda": forma, bajas y cuotas van en la misma dirección que el pick.
- "cautela": hay una señal contraria relevante (bajas clave, forma reciente opuesta, muestra pequeña, cuota que se movió, partido sin cuotas).
- "discrepa": dos o más señales contrarias fuertes, o la ventaja parece un error de datos (probabilidad extrema con muestra pequeña, equipo sin estadísticas).
- "risks": entre 0 y 3 frases cortas (máx. 12 palabras cada una), concretas, en español neutro, sin jerga.
- "note": una frase para el usuario, tono directo y calmado. Nunca prometas resultados. Nunca uses "garantizada", "segura" ni "fija".`;

export interface RevisionFacts {
  home: string;
  away: string;
  league: string;
  kickoff: string;
  pickLabel: string;
  pickProb: number;
  pickPrice: number | null;
  pickEdge: number | null;
  selloModelo: Sello;
  lambdaHome: number;
  lambdaAway: number;
  probHome: number;
  probDraw: number;
  probAway: number;
  homeForm: string;
  awayForm: string;
  homePlayed: number;
  awayPlayed: number;
  homeXgPerGame: number | null;
  awayXgPerGame: number | null;
  homeMissing: string[];
  awayMissing: string[];
  bookmakers: number;
  referee: string | null;
  refereeCards: number | null;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function revisionUserMessage(f: RevisionFacts): string {
  return [
    `Partido: ${f.home} vs ${f.away} · ${f.league} · ${f.kickoff}`,
    `Pick del modelo: ${f.pickLabel} · prob ${pct(f.pickProb)} · cuota ${f.pickPrice?.toFixed(2) ?? 'sin cuota'} · ventaja ${f.pickEdge === null ? 'n/d' : `${(f.pickEdge * 100).toFixed(1)}%`} · sello ${f.selloModelo.toUpperCase()}`,
    `Modelo 1X2: ${f.home} ${pct(f.probHome)} · empate ${pct(f.probDraw)} · ${f.away} ${pct(f.probAway)} · goles esperados ${f.lambdaHome.toFixed(2)}–${f.lambdaAway.toFixed(2)}`,
    `${f.home}: forma ${f.homeForm || 'sin datos'} · ${f.homePlayed} partidos en la temporada · xG/partido ${f.homeXgPerGame?.toFixed(2) ?? 'n/d'} · bajas: ${f.homeMissing.length ? f.homeMissing.join(', ') : 'ninguna reportada'}`,
    `${f.away}: forma ${f.awayForm || 'sin datos'} · ${f.awayPlayed} partidos en la temporada · xG/partido ${f.awayXgPerGame?.toFixed(2) ?? 'n/d'} · bajas: ${f.awayMissing.length ? f.awayMissing.join(', ') : 'ninguna reportada'}`,
    `Casas con cuota: ${f.bookmakers}${f.referee ? ` · árbitro ${f.referee}${f.refereeCards !== null ? ` (${f.refereeCards.toFixed(1)} tarjetas/partido)` : ''}` : ''}`,
  ].join('\n');
}

export type AiVerdict = 'concuerda' | 'cautela' | 'discrepa';

export interface AiReview {
  verdict: AiVerdict;
  risks: string[];
  note: string;
  sello_modelo: Sello;
  sello_final: Sello;
  model: string;
  key: string;
  at: string;
}

const BANNED = /garantizad|segura|fija/i;
const ORDER: Sello[] = ['baja', 'media', 'alta'];

/** El sello final solo baja: discrepa → dos niveles (mín. baja), cautela → un nivel. */
export function selloFinal(selloModelo: Sello, verdict: AiVerdict): Sello {
  const i = ORDER.indexOf(selloModelo);
  if (verdict === 'concuerda') return selloModelo;
  if (verdict === 'cautela') return ORDER[Math.max(0, i - 1)];
  return 'baja';
}

/** Parsea y valida la respuesta del modelo. Devuelve null si no es utilizable. */
export function parseRevision(text: string): { verdict: AiVerdict; risks: string[]; note: string } | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const verdict = o.verdict;
  if (verdict !== 'concuerda' && verdict !== 'cautela' && verdict !== 'discrepa') return null;
  const risks = Array.isArray(o.risks) ? o.risks.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 3).map((r) => r.trim().slice(0, 120)) : [];
  const note = typeof o.note === 'string' ? o.note.trim().slice(0, 240) : '';
  if (!note || BANNED.test(note) || risks.some((r) => BANNED.test(r))) return null;
  return { verdict, risks, note };
}

/** Clave de caché: si cambia el pick, el sello, las bajas o las λ redondeadas, se regenera. */
export function revisionKey(f: RevisionFacts): string {
  return [f.pickLabel, f.selloModelo, f.homeMissing.length, f.awayMissing.length, f.lambdaHome.toFixed(1), f.lambdaAway.toFixed(1), f.pickPrice?.toFixed(2) ?? '-'].join('|');
}
