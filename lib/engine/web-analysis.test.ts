import { describe, expect, it } from 'vitest';
import { parseWebAnalysis, webAnalysisKey, webAnalysisUserMessage, webSearchToolFor, type WebAnalysisFacts } from './web-analysis-prompt';

const facts: WebAnalysisFacts = { home: 'Flamengo', away: 'Palmeiras', league: 'Brasileirão Série A', kickoffIso: '2026-10-04T19:00:00Z', kickoffLabel: '4 oct 15:00 ET', probHome: 0.48, probDraw: 0.26, probAway: 0.26, probOver25: 0.52, homeForm: 'WWDWL', awayForm: 'WDWWW', homePlayed: 25, awayPlayed: 25 };

describe('análisis IA con búsqueda web', () => {
  it('elige la herramienta según el modelo', () => {
    expect(webSearchToolFor('claude-haiku-4-5').type).toBe('web_search_20250305');
    expect(webSearchToolFor('claude-sonnet-5').type).toBe('web_search_20260209');
    expect(webSearchToolFor('claude-haiku-4-5').max_uses).toBe(3);
  });
  it('parsea, acota y rechaza', () => {
    const ok = parseWebAnalysis('{"pick":"home","prob":0.56,"confidence":"media","summary":"Flamengo llega mejor.","risks":["Palmeiras recupera a su 9"],"sources":["https://ge.globo.com/x"]}');
    expect(ok).toMatchObject({ pick: 'home', prob: 0.56, confidence: 'media' });
    expect(parseWebAnalysis('{"pick":"home","prob":0.9,"confidence":"alta","summary":"x"}')).toBeNull(); // prob fuera de rango
    expect(parseWebAnalysis('{"pick":"home","prob":0.6,"confidence":"alta","summary":"Apuesta segura."}')).toBeNull(); // palabra prohibida
    expect(parseWebAnalysis('{"pick":"home","prob":0.6,"confidence":"alta","summary":"Buen momento."}')?.confidence).toBe('baja'); // alta se degrada
    expect(parseWebAnalysis('{"pick":"corner","prob":0.6,"confidence":"media","summary":"x"}')).toBeNull();
    expect(parseWebAnalysis('{"pick":"over25","prob":0.6,"confidence":"media","summary":"Goles.","sources":["ftp://x","https://a.com"]}')?.sources).toEqual(['https://a.com']);
  });
  it('mensaje con datos acotados y clave diaria', () => {
    const msg = webAnalysisUserMessage({ ...facts, home: 'Flamengo <script>' });
    expect(msg).toContain('<datos>');
    expect(msg).not.toContain('<script>');
    expect(webAnalysisKey(facts, '2026-10-03')).not.toBe(webAnalysisKey(facts, '2026-10-04'));
  });
});
