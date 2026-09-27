/** Emparejar partidos de API-Football con eventos de The Odds API por nombre + hora. Funciones puras. */

const STOP = new Set(['fc', 'cf', 'sc', 'ac', 'afc', 'cd', 'ca', 'club', 'de', 'del', 'la', 'el', 'los', 'las', 'the', 'deportivo', 'atletico', 'atlético', 'futbol', 'fútbol', 'football', 'and', 'y', 'united', 'utd']);

const ALIASES: Record<string, string> = {
  'america': 'club america',
  'inter miami cf': 'inter miami',
  'new york red bulls': 'ny red bulls',
  'new york city fc': 'nyc',
  'los angeles fc': 'lafc',
  'la galaxy': 'galaxy',
  'st louis city': 'st louis',
  'manchester united': 'man utd',
  'manchester city': 'man city',
  'tottenham hotspur': 'tottenham',
  'wolverhampton wanderers': 'wolves',
  'brighton and hove albion': 'brighton',
  'west ham united': 'west ham',
  'newcastle united': 'newcastle',
  'nottingham forest': 'forest',
  'racing club': 'racing',
  'atletico tucuman': 'tucuman',
  'talleres cordoba': 'talleres',
  'estudiantes lp': 'estudiantes',
  'gimnasia lp': 'gimnasia',
};

export function normalizeName(name: string): string {
  let s = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (ALIASES[s]) s = ALIASES[s];
  return s;
}

export function tokens(name: string): string[] {
  return normalizeName(name)
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

/** Similitud 0..1 entre dos nombres de equipo. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  // Bonus por prefijo (ej. "Tigres UANL" vs "Tigres")
  const first = [...ta][0] === [...tb][0] ? 0.15 : 0;
  return Math.min(1, jaccard + first);
}

export interface MatchableFixture {
  id: number;
  kickoff: string;
  home: string;
  away: string;
}
export interface MatchableEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

const WINDOW_MS = 3 * 60 * 60 * 1000;

/** Devuelve el mejor evento para cada fixture (score ≥ 0.6), sin reutilizar eventos. */
export function matchFixturesToEvents(fixtures: MatchableFixture[], events: MatchableEvent[]): Map<number, MatchableEvent> {
  const used = new Set<string>();
  const result = new Map<number, MatchableEvent>();
  const scored: Array<{ f: MatchableFixture; e: MatchableEvent; score: number }> = [];
  for (const f of fixtures) {
    const kf = new Date(f.kickoff).getTime();
    for (const e of events) {
      const ke = new Date(e.commence_time).getTime();
      if (Math.abs(kf - ke) > WINDOW_MS) continue;
      const s = (nameSimilarity(f.home, e.home_team) + nameSimilarity(f.away, e.away_team)) / 2;
      if (s >= 0.6) scored.push({ f, e, score: s - Math.abs(kf - ke) / WINDOW_MS / 10 });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  for (const { f, e } of scored) {
    if (result.has(f.id) || used.has(e.id)) continue;
    result.set(f.id, e);
    used.add(e.id);
  }
  return result;
}
