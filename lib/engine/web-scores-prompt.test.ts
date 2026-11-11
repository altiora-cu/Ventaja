import { describe, expect, it } from 'vitest';
import { parseWebScore, playedNearKickoff, webScoresUserMessage } from './web-scores-prompt';

describe('parseWebScore', () => {
  const ok = '{"status":"FT","home_goals":2,"away_goals":1,"played_on":"2026-11-08","confidence":"alta","sources":["https://www.espn.com/x"]}';

  it('acepta un marcador final con confianza alta y fuente', () => {
    expect(parseWebScore(`Resultado:\n${ok}`)).toEqual({ status: 'FT', home_goals: 2, away_goals: 1, played_on: '2026-11-08', sources: ['https://www.espn.com/x'] });
  });

  it('rechaza confianza media, sin fuentes, unknown o goles inválidos', () => {
    expect(parseWebScore(ok.replace('"alta"', '"media"'))).toBeNull();
    expect(parseWebScore(ok.replace('["https://www.espn.com/x"]', '[]'))).toBeNull();
    expect(parseWebScore(ok.replace('"FT"', '"unknown"'))).toBeNull();
    expect(parseWebScore(ok.replace('"home_goals":2', '"home_goals":2.5'))).toBeNull();
    expect(parseWebScore(ok.replace('"home_goals":2', '"home_goals":-1'))).toBeNull();
    expect(parseWebScore('sin json')).toBeNull();
  });

  it('acepta aplazado o cancelado sin goles', () => {
    expect(parseWebScore('{"status":"PST","home_goals":null,"away_goals":null,"played_on":null,"confidence":"alta","sources":["https://a.b/c"]}')).toMatchObject({ status: 'PST', home_goals: null });
  });

  it('comprueba que la fecha encontrada esté cerca de la prevista', () => {
    const s = parseWebScore(ok)!;
    expect(playedNearKickoff(s, '2026-11-08T20:00:00Z')).toBe(true);
    expect(playedNearKickoff(s, '2026-11-20T20:00:00Z')).toBe(false);
    expect(playedNearKickoff({ ...s, played_on: null }, '2026-11-20T20:00:00Z')).toBe(true);
  });

  it('el mensaje lleva equipos, competición y fecha', () => {
    const m = webScoresUserMessage({ home: 'Boca', away: 'Talleres', league: 'Liga Profesional', kickoffIso: '2026-10-16T22:00:00Z' });
    expect(m).toContain('Boca (local) vs Talleres');
    expect(m).toContain('2026-10-16');
  });
});
