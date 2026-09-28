import type { Sello } from '@/lib/db/types';
import { contextLines, selloFinal, type AiVerdict, type RevisionFacts } from './revision-prompt';

/**
 * Revisión IA por jugada: una sola llamada por partido audita todas las jugadas que el modelo
 * recomienda (las que cumplen el umbral de pick). Igual que la revisión del pick principal, la IA
 * no calcula probabilidades y solo puede BAJAR el sello. Funciones puras con tests.
 */
export const MAX_PLAYS_REVIEWED = 8;
export const PLAYS_MAX_TOKENS = 700;
const NOTE_MAX_CHARS = 200;

export const PLAYS_SYSTEM = `Eres el revisor de riesgos de Ventaja, una sala de análisis estadístico de fútbol.
Recibes el contexto de un partido y una lista numerada de jugadas que produjo un modelo Poisson/Dixon-Coles.
Tu trabajo NO es predecir el resultado ni cambiar probabilidades: es auditar, jugada por jugada, si el contexto la respalda o la contradice.
Responde SOLO con un JSON válido, sin texto alrededor, con esta forma exacta:
{"plays":[{"n":1,"verdict":"concuerda"|"cautela"|"discrepa","note":"..."}]}
Reglas:
- Una entrada por cada jugada recibida, con su mismo número "n".
- "concuerda": forma, bajas y cuotas van en la misma dirección que la jugada.
- "cautela": hay una señal contraria relevante (bajas clave, forma reciente opuesta, muestra pequeña, pocas casas con cuota).
- "discrepa": dos o más señales contrarias fuertes, o la ventaja parece un error de datos.
- Si dos jugadas se contradicen entre sí, como máximo una puede llevar "concuerda".
- "note": una frase de hasta 20 palabras para el usuario, en español neutro, tono directo y calmado. Nunca prometas resultados. Nunca uses "garantizada", "segura" ni "fija".`;

export interface PlayFacts {
  /** Clave estable de la selección (mercado, selección, línea y jugador). */
  key: string;
  label: string;
  prob: number;
  price: number | null;
  edge: number | null;
  sello: Sello;
}

export interface AiPlayReview {
  key: string;
  verdict: AiVerdict;
  note: string;
  sello_modelo: Sello;
  sello_final: Sello;
}

const BANNED = /garantizad|segura|fija/i;
const VERDICTS: readonly AiVerdict[] = ['concuerda', 'cautela', 'discrepa'];
const pct = (p: number) => `${Math.round(p * 100)}%`;

function isVerdict(v: unknown): v is AiVerdict {
  return typeof v === 'string' && (VERDICTS as readonly string[]).includes(v);
}

export function playsUserMessage(f: RevisionFacts, plays: readonly PlayFacts[]): string {
  const list = plays.map(
    (p, i) => `${i + 1}. ${p.label} · prob ${pct(p.prob)} · cuota ${p.price?.toFixed(2) ?? 'sin cuota'} · ventaja ${p.edge === null ? 'n/d' : `${(p.edge * 100).toFixed(1)}%`} · sello ${p.sello.toUpperCase()}`,
  );
  return [`Partido: ${f.home} vs ${f.away} · ${f.league} · ${f.kickoff}`, ...contextLines(f), 'Jugadas del modelo:', ...list].join('\n');
}

/**
 * Parsea y valida la respuesta. Devuelve solo las jugadas con veredicto utilizable; las que falten
 * o vengan mal formadas se quedan sin revisión (la app muestra entonces el sello del modelo).
 * Devuelve null si la respuesta entera no sirve.
 */
export function parsePlaysReview(text: string, plays: readonly PlayFacts[]): AiPlayReview[] | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const rows = (obj as { plays?: unknown } | null)?.plays;
  if (!Array.isArray(rows)) return null;

  const out = new Map<string, AiPlayReview>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const { n, verdict, note } = row as Record<string, unknown>;
    const play = typeof n === 'number' && Number.isInteger(n) ? plays[n - 1] : undefined;
    if (!play || out.has(play.key) || !isVerdict(verdict) || typeof note !== 'string') continue;
    const clean = note.trim().slice(0, NOTE_MAX_CHARS);
    if (!clean || BANNED.test(clean)) continue;
    out.set(play.key, { key: play.key, verdict, note: clean, sello_modelo: play.sello, sello_final: selloFinal(play.sello, verdict) });
  }
  return out.size ? [...out.values()] : null;
}

/** Clave de caché: si cambian las jugadas, sus sellos, sus cuotas o las bajas, se vuelve a revisar. */
export function playsKey(f: RevisionFacts, plays: readonly PlayFacts[]): string {
  return [f.homeMissing.length, f.awayMissing.length, ...plays.map((p) => `${p.key}:${p.sello}:${p.price?.toFixed(2) ?? '-'}`)].join('|');
}

/** Veredictos por clave de jugada, para consultarlos desde la interfaz. */
export function verdictsByKey(plays: readonly AiPlayReview[] | null | undefined): Map<string, AiPlayReview> {
  return new Map((plays ?? []).map((p) => [p.key, p]));
}
