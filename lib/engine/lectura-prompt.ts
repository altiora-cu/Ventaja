/**
 * Prompt fijo para generar la Lectura de un partido.
 * No prometas resultados; no uses "garantizada", "segura" ni "fija".
 */
export const LECTURA_SYSTEM_ES = `Eres el analista de Ventaja, una sala de análisis estadístico de fútbol.
Escribe 3–5 frases cortas en español neutro, sin jerga, que expliquen la forma de ambos equipos, el mercado con más ventaja y una advertencia si la confianza es Baja.
Habla de "tú" al lector. Tono directo y calmado, sin gritar. No prometas resultados. Nunca uses las palabras "garantizada", "segura" ni "fija". No menciones casas de apuestas por nombre.
Responde solo con el texto de la Lectura, sin título ni viñetas.`;

export const LECTURA_SYSTEM_EN = `You are the analyst at Ventaja, a football statistical analysis room.
Write 3–5 short sentences in plain English, no jargon, explaining both teams' form, the market with the biggest edge, and a warning if confidence is Low.
Address the reader as "you". Direct, calm tone. Never promise results. Never use the words "guaranteed", "safe", "sure" or "lock". Do not name bookmakers.
Reply only with the Read text, no title or bullets.`;

export const LECTURA_MODEL = 'claude-haiku-4-5';
export const LECTURA_MAX_TOKENS = 220;
export const LECTURA_TEMPERATURE = 0.4;

export interface LecturaFacts {
  home: string;
  away: string;
  league: string;
  homeForm: string; // ej. "WWDLW"
  awayForm: string;
  homeGoalsPerGame: number;
  awayGoalsPerGame: number;
  homeXg: number | null;
  awayXg: number | null;
  homeMissing: number;
  awayMissing: number;
  probHome: number;
  probDraw: number;
  probAway: number;
  probOver25: number;
  topMarketLabel: string;
  topMarketProb: number;
  topMarketPrice: number | null;
  topMarketEdge: number | null;
  sello: 'alta' | 'media' | 'baja';
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function lecturaUserMessage(f: LecturaFacts, locale: 'es' | 'en'): string {
  const lines = [
    `${locale === 'es' ? 'Partido' : 'Match'}: ${f.home} vs ${f.away} (${f.league})`,
    `${f.home}: ${locale === 'es' ? 'forma' : 'form'} ${f.homeForm || '—'}, ${f.homeGoalsPerGame.toFixed(1)} ${locale === 'es' ? 'goles/partido' : 'goals/game'}${f.homeXg !== null ? `, xG ${f.homeXg.toFixed(2)}` : ''}, ${f.homeMissing} ${locale === 'es' ? 'bajas' : 'missing'}`,
    `${f.away}: ${locale === 'es' ? 'forma' : 'form'} ${f.awayForm || '—'}, ${f.awayGoalsPerGame.toFixed(1)} ${locale === 'es' ? 'goles/partido' : 'goals/game'}${f.awayXg !== null ? `, xG ${f.awayXg.toFixed(2)}` : ''}, ${f.awayMissing} ${locale === 'es' ? 'bajas' : 'missing'}`,
    `${locale === 'es' ? 'Modelo' : 'Model'}: ${f.home} ${pct(f.probHome)} · ${locale === 'es' ? 'empate' : 'draw'} ${pct(f.probDraw)} · ${f.away} ${pct(f.probAway)} · +2.5 ${locale === 'es' ? 'goles' : 'goals'} ${pct(f.probOver25)}`,
    `${locale === 'es' ? 'Mercado con más ventaja' : 'Biggest edge'}: ${f.topMarketLabel} — ${pct(f.topMarketProb)}${f.topMarketPrice ? `, ${locale === 'es' ? 'cuota' : 'odds'} ${f.topMarketPrice.toFixed(2)}` : ''}${f.topMarketEdge !== null ? `, ${locale === 'es' ? 'ventaja' : 'edge'} ${(f.topMarketEdge * 100).toFixed(1)}%` : ''}`,
    `${locale === 'es' ? 'Sello de confianza' : 'Confidence seal'}: ${f.sello.toUpperCase()}`,
  ];
  return lines.join('\n');
}

/** Lectura determinista de respaldo (sin API). Cumple las mismas reglas de tono. */
export function lecturaFallback(f: LecturaFacts, locale: 'es' | 'en'): string {
  const es = locale === 'es';
  const formClause = (form: string, name: string) => {
    const w = (form.match(/W/g) ?? []).length;
    const l = (form.match(/L/g) ?? []).length;
    if (!form) return es ? `${name} llega sin muestra suficiente de forma` : `${name} arrives without enough form data`;
    if (w >= 3) return es ? `${name} llega en buen momento, con ${w} victorias en los últimos ${form.length}` : `${name} arrives in good shape, with ${w} wins in the last ${form.length}`;
    if (l >= 3) return es ? `${name} llega tocado, con ${l} derrotas en los últimos ${form.length}` : `${name} is struggling, with ${l} losses in the last ${form.length}`;
    return es ? `${name} alterna resultados (${form})` : `${name} is mixing results (${form})`;
  };
  const missingClause = (n: number) => (n > 0 ? (es ? ` y ${n} ${n === 1 ? 'baja' : 'bajas'}` : ` and ${n} ${n === 1 ? 'player' : 'players'} missing`) : '');
  const s1 = `${formClause(f.homeForm, f.home)}${missingClause(f.homeMissing)}.`;
  const s2 = `${formClause(f.awayForm, f.away)}${missingClause(f.awayMissing)}.`;
  const fav = f.probHome >= f.probAway ? f.home : f.away;
  const favP = Math.max(f.probHome, f.probAway);
  const s3 = es
    ? `El modelo ve ${pct(favP)} a ${fav} y más de 2.5 goles al ${pct(f.probOver25)}.`
    : `The model gives ${fav} ${pct(favP)} and over 2.5 goals ${pct(f.probOver25)}.`;
  let s4: string;
  if (f.topMarketPrice && f.topMarketEdge !== null && f.topMarketEdge > 0) {
    s4 = es
      ? `${f.topMarketLabel} (${f.topMarketPrice.toFixed(2)}) paga por encima de lo que debería: ahí está la ventaja.`
      : `${f.topMarketLabel} (${f.topMarketPrice.toFixed(2)}) pays more than it should: that's the edge.`;
  } else {
    s4 = es ? `El mercado con más valor es ${f.topMarketLabel}, pero el margen es corto.` : `The best-value market is ${f.topMarketLabel}, but the margin is thin.`;
  }
  const s5 = f.sello === 'baja' ? (es ? 'La confianza es baja: si entras, que sea con cabeza fría.' : 'Confidence is low: if you go in, keep a cool head.') : '';
  return [s1, s2, s3, s4, s5].filter(Boolean).join(' ');
}
