import { describe, expect, it } from 'vitest';
import { parseRevision, revisionKey, revisionUserMessage, selloFinal, type RevisionFacts } from './revision-prompt';

const facts: RevisionFacts = {
  home: 'Tigres', away: 'Pumas', league: 'Liga MX', kickoff: '2026-09-27 21:00', pickLabel: 'Gana Tigres', pickProb: 0.61, pickPrice: 1.72, pickEdge: 0.06, selloModelo: 'media',
  lambdaHome: 1.9, lambdaAway: 0.8, probHome: 0.61, probDraw: 0.22, probAway: 0.17, homeForm: 'WWDWW', awayForm: 'LLLDW', homePlayed: 12, awayPlayed: 12,
  homeXgPerGame: 1.8, awayXgPerGame: 0.9, homeMissing: [], awayMissing: ['J. Dinenno'], bookmakers: 6, referee: 'R. Pérez', refereeCards: 4.9,
};

describe('revisión IA', () => {
  it('el sello final solo baja', () => {
    expect(selloFinal('alta', 'concuerda')).toBe('alta');
    expect(selloFinal('alta', 'cautela')).toBe('media');
    expect(selloFinal('alta', 'discrepa')).toBe('baja');
    expect(selloFinal('media', 'cautela')).toBe('baja');
    expect(selloFinal('baja', 'cautela')).toBe('baja');
  });

  it('parsea JSON válido y rechaza inválido o con palabras prohibidas', () => {
    expect(parseRevision('{"verdict":"cautela","risks":["Pumas sin su 9"],"note":"Ojo con la baja."}')).toEqual({ verdict: 'cautela', risks: ['Pumas sin su 9'], note: 'Ojo con la baja.' });
    expect(parseRevision('Claro, aquí va: {"verdict":"concuerda","risks":[],"note":"Todo apunta a Tigres."} fin')).toMatchObject({ verdict: 'concuerda' });
    expect(parseRevision('{"verdict":"seguro","risks":[],"note":"x"}')).toBeNull();
    expect(parseRevision('{"verdict":"concuerda","risks":[],"note":"Apuesta segura."}')).toBeNull();
    expect(parseRevision('no json')).toBeNull();
    expect(parseRevision('{"verdict":"discrepa","risks":["a","b","c","d","e"],"note":"n"}')!.risks).toHaveLength(3);
  });

  it('mensaje incluye pick, forma y bajas; la clave cambia con las bajas', () => {
    const msg = revisionUserMessage(facts);
    expect(msg).toContain('Gana Tigres');
    expect(msg).toContain('WWDWW');
    expect(msg).toContain('J. Dinenno');
    expect(revisionKey(facts)).not.toBe(revisionKey({ ...facts, awayMissing: [] }));
  });
});
