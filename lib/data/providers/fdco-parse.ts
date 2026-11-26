import type { FixtureStats } from '@/lib/db/types';

/**
 * football-data.co.uk: archivos CSV gratuitos, sin clave. Por temporada y liga traen resultado, xG, tiros,
 * tiros al arco, corners y tarjetas de cada partido; `fixtures.csv` trae los próximos partidos con cuotas de
 * varias casas (se publica viernes ≤ 17:00 y martes ≤ 13:00, hora de Reino Unido). Funciones puras.
 */

/** Liga nuestra → división del proveedor. Solo las que publica con estadísticas completas. */
export const FDCO_DIV: Record<number, string> = { 39: 'E0', 140: 'SP1', 135: 'I1', 78: 'D1', 61: 'F1' };

export const FDCO_BASE = 'https://www.football-data.co.uk';

/** 2026 → "2627" (carpeta de la temporada 2026/27). */
export function fdcoSeasonCode(season: number): string {
  const a = String(season % 100).padStart(2, '0');
  const b = String((season + 1) % 100).padStart(2, '0');
  return `${a}${b}`;
}

export interface FdcoRow {
  div: string;
  /** Pitazo en UTC (el archivo viene en hora de Reino Unido). */
  kickoff: string;
  home: string;
  away: string;
  raw: Record<string, string>;
}

/** Desfase de Europe/London respecto a UTC en ese instante, en minutos (0 en invierno, 60 en verano). */
function londonOffsetMinutes(utc: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((asUtc - utc.getTime()) / 60000);
}

/** "23/11/2026" o "23/11/26" + "20:00" (hora de Reino Unido) → ISO en UTC. null si la fecha no es válida. */
export function fdcoKickoff(date: string, time: string | undefined): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(date.trim());
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const t = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  const naive = Date.UTC(year, Number(m[2]) - 1, Number(m[1]), t ? Number(t[1]) : 15, t ? Number(t[2]) : 0);
  if (Number.isNaN(naive)) return null;
  return new Date(naive - londonOffsetMinutes(new Date(naive)) * 60000).toISOString();
}

/** CSV simple (sin comillas con comas dentro, que este proveedor no usa). Ignora filas sin equipos. */
export function parseFdcoCsv(text: string): FdcoRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const out: FdcoRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const raw: Record<string, string> = {};
    header.forEach((h, i) => { if (h) raw[h] = (cells[i] ?? '').trim(); });
    const kickoff = fdcoKickoff(raw.Date ?? '', raw.Time);
    if (!raw.Div || !raw.HomeTeam || !raw.AwayTeam || !kickoff) continue;
    out.push({ div: raw.Div, kickoff, home: raw.HomeTeam, away: raw.AwayTeam, raw });
  }
  return out;
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** true si la fila ya tiene resultado final. */
export function fdcoFinished(row: FdcoRow): boolean {
  return num(row.raw.FTHG) !== null && num(row.raw.FTAG) !== null;
}

/** Estadísticas del partido en nuestro formato. Solo incluye lo que el archivo trae. null si no trae nada. */
export function fdcoStats(row: FdcoRow): FixtureStats | null {
  const pair = (h: string, a: string) => {
    const x = num(row.raw[h]);
    const y = num(row.raw[a]);
    return x === null || y === null ? undefined : { home: x, away: y };
  };
  const stats: FixtureStats = {};
  const shots = pair('HS', 'AS');
  const sot = pair('HST', 'AST');
  const corners = pair('HC', 'AC');
  const yellow = pair('HY', 'AY');
  const red = pair('HR', 'AR');
  const xg = pair('HxG', 'AxG');
  if (shots) stats.shots = shots;
  if (sot) stats.sot = sot;
  if (corners) stats.corners = corners;
  if (yellow) stats.yellow = yellow;
  if (red) stats.red = red;
  if (xg) stats.xg = xg;
  return Object.keys(stats).length ? stats : null;
}

/** Casas con cuota propia en los archivos (Max y Avg son agregados, no casas). */
const BOOKS: Record<string, string> = { B365: 'Bet365', BW: 'Bwin', BFD: 'Betfred', BV: 'BetVictor', PP: 'Paddy Power', SKB: 'Sky Bet', BFE: 'Betfair Exchange', BF: 'Betfair', '1XB': '1xBet', PS: 'Pinnacle', WH: 'William Hill' };

export interface FdcoQuote {
  bookmaker: string;
  market: '1x2' | 'totals';
  selection: 'home' | 'draw' | 'away' | 'over' | 'under';
  line: number | null;
  price: number;
}

/** Cuotas previas al cierre de la fila: 1X2 y más/menos 2.5 de cada casa disponible. */
export function fdcoQuotes(row: FdcoRow): FdcoQuote[] {
  const out: FdcoQuote[] = [];
  const push = (bookmaker: string, market: FdcoQuote['market'], selection: FdcoQuote['selection'], line: number | null, v: string | undefined) => {
    const price = num(v);
    if (price !== null && price > 1.01 && price < 200) out.push({ bookmaker, market, selection, line, price });
  };
  for (const [code, name] of Object.entries(BOOKS)) {
    if (!name) continue;
    push(name, '1x2', 'home', null, row.raw[`${code}H`]);
    push(name, '1x2', 'draw', null, row.raw[`${code}D`]);
    push(name, '1x2', 'away', null, row.raw[`${code}A`]);
    push(name, 'totals', 'over', 2.5, row.raw[`${code}>2.5`]);
    push(name, 'totals', 'under', 2.5, row.raw[`${code}<2.5`]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Emparejado de nombres: el proveedor abrevia ("Ath Madrid", "M'gladbach"); nuestra base usa el nombre oficial.
// ---------------------------------------------------------------------------------------------------------

/** Abreviaturas del proveedor que no se resuelven por coincidencia de palabras. */
const FDCO_ALIASES: Record<string, string> = {
  'ath madrid': 'atletico madrid',
  'ath bilbao': 'athletic club',
  espanol: 'espanyol',
  'man city': 'manchester city',
  'man united': 'manchester united',
  'nott m forest': 'nottingham forest',
  'bayern munich': 'bayern munchen',
  'ein frankfurt': 'eintracht frankfurt',
  'm gladbach': 'monchengladbach',
  'fc koln': 'koln',
  'paris sg': 'paris saint germain',
  rennes: 'rennais',
  'st etienne': 'saint etienne',
  inter: 'internazionale',
  verona: 'hellas verona',
  wolves: 'wolverhampton',
  'sp gijon': 'sporting gijon',
};

/** Palabras que no distinguen a un club de otro. "real" se conserva: separa Real Madrid de Atlético de Madrid. */
const GENERIC = new Set(['fc', 'cf', 'ac', 'as', 'sc', 'rc', 'rcd', 'ca', 'cd', 'ud', 'sv', 'afc', 'bc', 'cfc', 'ss', 'ssc', 'us', 'aj', 'es', 'ogc', 'acf', 'fsv', 'tsg', 'vfb', 'vfl', 'osc', 'sco', 'club', 'de', 'del', 'calcio', 'balompie', 'futbol', 'and']);

function norm(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distinctive(name: string): string[] {
  return norm(name)
    .split(' ')
    .filter((t) => t && !GENERIC.has(t) && !/^\d+$/.test(t));
}

/** Dos palabras coinciden si son iguales o una (de 4+ letras) es el comienzo de la otra: "hamburg" ~ "hamburger". */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/**
 * Parecido 0–1 entre el nombre del proveedor y el nuestro: qué parte del nombre corto está en el oficial,
 * con un pequeño descuento si el oficial tiene más palabras propias ("Barcelona" prefiere "FC Barcelona"
 * a "RCD Espanyol de Barcelona").
 */
export function fdcoSimilarity(fdcoName: string, dbName: string): number {
  const aliased = FDCO_ALIASES[norm(fdcoName)] ?? norm(fdcoName);
  const a = distinctive(aliased);
  const b = distinctive(dbName);
  if (!a.length || !b.length) return 0;
  const hit = a.filter((t) => b.some((u) => tokenMatch(t, u))).length;
  const containment = hit / a.length;
  const coverage = b.filter((u) => a.some((t) => tokenMatch(t, u))).length / b.length;
  return containment * (0.75 + 0.25 * coverage);
}

export interface FdcoFixtureRef {
  id: number;
  kickoff: string;
  home: string;
  away: string;
}

const MATCH_WINDOW_MS = 36 * 3600_000;
const MIN_SIDE = 0.6;

/**
 * Empareja filas del archivo con nuestros partidos: mismo cruce (ambos equipos parecidos) a ≤ 36 h del pitazo.
 * Voraz por puntuación y sin repetir partido. Devuelve índice de fila → id de partido.
 */
export function matchFdcoRows(rows: readonly FdcoRow[], fixtures: readonly FdcoFixtureRef[]): Map<number, number> {
  const scored: Array<{ row: number; id: number; score: number }> = [];
  rows.forEach((r, i) => {
    const kr = new Date(r.kickoff).getTime();
    for (const f of fixtures) {
      const delta = Math.abs(new Date(f.kickoff).getTime() - kr);
      if (delta > MATCH_WINDOW_MS) continue;
      const sh = fdcoSimilarity(r.home, f.home);
      const sa = fdcoSimilarity(r.away, f.away);
      if (sh < MIN_SIDE || sa < MIN_SIDE) continue;
      scored.push({ row: i, id: f.id, score: (sh + sa) / 2 - delta / MATCH_WINDOW_MS / 20 });
    }
  });
  scored.sort((a, b) => b.score - a.score);
  const out = new Map<number, number>();
  const used = new Set<number>();
  for (const s of scored) {
    if (out.has(s.row) || used.has(s.id)) continue;
    out.set(s.row, s.id);
    used.add(s.id);
  }
  return out;
}
