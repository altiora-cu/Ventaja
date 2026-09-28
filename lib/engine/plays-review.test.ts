import { describe, expect, it } from 'vitest';
import { parsePlaysReview, playsKey, playsUserMessage, verdictsByKey, type PlayFacts } from './plays-review';
import type { RevisionFacts } from './revision-prompt';

const facts: RevisionFacts = {
  home: 'Tigres', away: 'Pumas', league: 'Liga MX', kickoff: '2026-09-27 21:00', pickLabel: 'Gana Tigres', pickProb: 0.61, pickPrice: 1.72, pickEdge: 0.06, selloModelo: 'media',
  lambdaHome: 1.9, lambdaAway: 0.8, probHome: 0.61, probDraw: 0.22, probAway: 0.17, homeForm: 'WWDWW', awayForm: 'LLLDW', homePlayed: 12, awayPlayed: 12,
  homeXgPerGame: 1.8, awayXgPerGame: 0.9, homeMissing: [], awayMissing: ['J. Dinenno'], bookmakers: 6, referee: 'R. Pérez', refereeCards: 4.9,
};

const plays: PlayFacts[] = [
  { key: '1x2|home||', label: 'Gana Tigres', prob: 0.61, price: 1.72, edge: 0.06, sello: 'media' },
  { key: 'totals|under|3.5|', label: 'Goles totales · Menos de 3.5', prob: 0.78, price: 1.4, edge: 0.09, sello: 'alta' },
];

describe('revisión IA por jugada', () => {
  it('el mensaje numera las jugadas e incluye el contexto del partido', () => {
    const msg = playsUserMessage(facts, plays);
    expect(msg).toContain('1. Gana Tigres');
    expect(msg).toContain('2. Goles totales · Menos de 3.5');
    expect(msg).toContain('WWDWW');
    expect(msg).toContain('J. Dinenno');
  });

  it('asigna cada veredicto a su jugada y el sello final solo baja', () => {
    const out = parsePlaysReview('{"plays":[{"n":2,"verdict":"cautela","note":"Pocos goles, pero Pumas llega sin su delantero."},{"n":1,"verdict":"concuerda","note":"La forma respalda a Tigres."}]}', plays);
    expect(out).toHaveLength(2);
    const byKey = verdictsByKey(out);
    expect(byKey.get('1x2|home||')).toMatchObject({ verdict: 'concuerda', sello_modelo: 'media', sello_final: 'media' });
    expect(byKey.get('totals|under|3.5|')).toMatchObject({ verdict: 'cautela', sello_modelo: 'alta', sello_final: 'media' });
  });

  it('descarta entradas inválidas sin perder las válidas', () => {
    const text = '{"plays":[{"n":1,"verdict":"concuerda","note":"Apuesta segura."},{"n":9,"verdict":"cautela","note":"No existe."},{"n":2,"verdict":"quizá","note":"x"},{"n":2,"verdict":"discrepa","note":"La ventaja parece un error de datos."},{"n":2,"verdict":"concuerda","note":"Repetida."}]}';
    const out = parsePlaysReview(text, plays);
    expect(out).toEqual([{ key: 'totals|under|3.5|', verdict: 'discrepa', note: 'La ventaja parece un error de datos.', sello_modelo: 'alta', sello_final: 'baja' }]);
  });

  it('devuelve null si la respuesta no es utilizable', () => {
    expect(parsePlaysReview('no json', plays)).toBeNull();
    expect(parsePlaysReview('{"plays":"nada"}', plays)).toBeNull();
    expect(parsePlaysReview('{"plays":[]}', plays)).toBeNull();
    expect(parsePlaysReview('{"verdict":"concuerda"}', plays)).toBeNull();
  });

  it('la clave de caché cambia con las jugadas, las cuotas y las bajas', () => {
    const base = playsKey(facts, plays);
    expect(playsKey(facts, plays)).toBe(base);
    expect(playsKey(facts, plays.slice(0, 1))).not.toBe(base);
    expect(playsKey(facts, [{ ...plays[0], price: 1.8 }, plays[1]])).not.toBe(base);
    expect(playsKey({ ...facts, awayMissing: [] }, plays)).not.toBe(base);
  });

  it('verdictsByKey tolera la ausencia de revisión', () => {
    expect(verdictsByKey(null).size).toBe(0);
    expect(verdictsByKey(undefined).size).toBe(0);
  });
});
