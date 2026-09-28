import { describe, expect, it } from 'vitest';
import { matchFixturesToEvents, nameSimilarity, normalizeName } from './matching';

describe('matching', () => {
  it('normaliza acentos y sufijos', () => {
    expect(normalizeName('Atlético de Madrid')).toBe('atletico de madrid');
    expect(nameSimilarity('Tigres UANL', 'Tigres')).toBeGreaterThan(0.8);
    expect(nameSimilarity('Club América', 'América')).toBeGreaterThan(0.8);
    expect(nameSimilarity('Manchester United', 'Man Utd')).toBe(1);
    expect(nameSimilarity('Pumas UNAM', 'Cruz Azul')).toBeLessThan(0.3);
  });

  it('empareja clubes brasileños entre football-data.org y The Odds API', () => {
    expect(nameSimilarity('CR Flamengo', 'Flamengo-RJ')).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity('SE Palmeiras', 'Palmeiras-SP')).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity('RB Bragantino', 'Bragantino-SP')).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity('CA Mineiro', 'Atletico Mineiro')).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity('São Paulo FC', 'Sao Paulo')).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity('Estudiantes de La Plata', 'Estudiantes La Plata')).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity('CR Flamengo', 'Fluminense-RJ')).toBeLessThan(0.6);
    expect(nameSimilarity('SE Palmeiras', 'Sao Paulo')).toBeLessThan(0.6);
  });

  it('empareja por nombre y ventana horaria sin repetir eventos', () => {
    const t = '2026-09-27T23:00:00Z';
    const fixtures = [
      { id: 1, kickoff: t, home: 'Tigres UANL', away: 'Pumas UNAM' },
      { id: 2, kickoff: t, home: 'Club América', away: 'Guadalajara Chivas' },
      { id: 3, kickoff: '2026-09-29T23:00:00Z', home: 'Tigres UANL', away: 'Cruz Azul' },
    ];
    const events = [
      { id: 'a', commence_time: '2026-09-27T23:05:00Z', home_team: 'Tigres', away_team: 'Pumas' },
      { id: 'b', commence_time: t, home_team: 'América', away_team: 'Chivas' },
    ];
    const m = matchFixturesToEvents(fixtures, events);
    expect(m.get(1)?.id).toBe('a');
    expect(m.get(2)?.id).toBe('b');
    expect(m.has(3)).toBe(false);
  });
});
