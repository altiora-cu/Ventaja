import { describe, expect, it } from 'vitest';
import { fdcoFinished, fdcoKickoff, fdcoQuotes, fdcoSeasonCode, fdcoSimilarity, fdcoStats, matchFdcoRows, parseFdcoCsv } from './fdco-parse';

const CSV = `﻿Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,HxG,AxG,HS,AS,HST,AST,HC,AC,HY,AY,HR,AR,B365H,B365D,B365A,BWH,BWD,BWA,MaxH,B365>2.5,B365<2.5
SP1,23/11/2026,20:00,Ath Madrid,Betis,2,1,1.9,0.7,15,6,7,2,8,3,2,3,0,1,1.6,4,5.5,1.62,3.9,5.25,1.7,1.8,2
SP1,29/11/2026,15:15,Barcelona,Espanol,,,,,,,,,,,,,,,1.2,7,13,,,,1.25,1.4,3
`;

describe('fdco-parse', () => {
  it('lee filas, convierte la hora de Reino Unido a UTC y la temporada a carpeta', () => {
    const rows = parseFdcoCsv(CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ div: 'SP1', home: 'Ath Madrid', away: 'Betis', kickoff: '2026-11-23T20:00:00.000Z' });
    expect(fdcoKickoff('15/08/2026', '20:00')).toBe('2026-08-15T19:00:00.000Z'); // horario de verano
    expect(fdcoKickoff('15/08/26', '20:00')).toBe('2026-08-15T19:00:00.000Z');
    expect(fdcoKickoff('no', '20:00')).toBeNull();
    expect(fdcoSeasonCode(2026)).toBe('2627');
    expect(fdcoSeasonCode(2099)).toBe('9900');
  });

  it('extrae estadísticas y cuotas, e ignora lo que falta', () => {
    const [played, upcoming] = parseFdcoCsv(CSV);
    expect(fdcoFinished(played)).toBe(true);
    expect(fdcoFinished(upcoming)).toBe(false);
    expect(fdcoStats(played)).toEqual({ shots: { home: 15, away: 6 }, sot: { home: 7, away: 2 }, corners: { home: 8, away: 3 }, yellow: { home: 2, away: 3 }, red: { home: 0, away: 1 }, xg: { home: 1.9, away: 0.7 } });
    expect(fdcoStats(upcoming)).toBeNull();
    const q = fdcoQuotes(upcoming);
    expect(q).toEqual([
      { bookmaker: 'Bet365', market: '1x2', selection: 'home', line: null, price: 1.2 },
      { bookmaker: 'Bet365', market: '1x2', selection: 'draw', line: null, price: 7 },
      { bookmaker: 'Bet365', market: '1x2', selection: 'away', line: null, price: 13 },
      { bookmaker: 'Bet365', market: 'totals', selection: 'over', line: 2.5, price: 1.4 },
      { bookmaker: 'Bet365', market: 'totals', selection: 'under', line: 2.5, price: 3 },
    ]);
    expect(fdcoQuotes(played).filter((x) => x.bookmaker === 'Bwin')).toHaveLength(3);
  });

  it('reconoce las abreviaturas del proveedor', () => {
    expect(fdcoSimilarity('Ath Madrid', 'Club Atlético de Madrid')).toBeGreaterThan(0.9);
    expect(fdcoSimilarity('Ath Madrid', 'Real Madrid CF')).toBeLessThan(0.6);
    expect(fdcoSimilarity('Real Madrid', 'Club Atlético de Madrid')).toBeLessThan(0.6);
    expect(fdcoSimilarity('Barcelona', 'FC Barcelona')).toBeGreaterThan(fdcoSimilarity('Barcelona', 'RCD Espanyol de Barcelona'));
    expect(fdcoSimilarity("M'gladbach", 'Borussia Mönchengladbach')).toBeGreaterThan(0.8);
    expect(fdcoSimilarity('Hamburg', 'Hamburger SV')).toBeGreaterThan(0.9);
    expect(fdcoSimilarity('Inter', 'FC Internazionale Milano')).toBeGreaterThan(fdcoSimilarity('Inter', 'AC Milan'));
    expect(fdcoSimilarity('Milan', 'AC Milan')).toBeGreaterThan(fdcoSimilarity('Milan', 'FC Internazionale Milano'));
    expect(fdcoSimilarity('Paris SG', 'Paris Saint-Germain FC')).toBeGreaterThan(fdcoSimilarity('Paris SG', 'Paris FC'));
    expect(fdcoSimilarity('Rennes', 'Stade Rennais FC 1901')).toBeGreaterThan(0.8);
    expect(fdcoSimilarity("Nott'm Forest", 'Nottingham Forest FC')).toBeGreaterThan(0.9);
  });

  it('empareja por cruce y fecha, sin repetir partido ni cruzar la ida con la vuelta', () => {
    const rows = parseFdcoCsv(CSV);
    const fixtures = [
      { id: 1, kickoff: '2026-11-23T20:00:00Z', home: 'Club Atlético de Madrid', away: 'Real Betis Balompié' },
      { id: 2, kickoff: '2026-11-29T15:15:00Z', home: 'FC Barcelona', away: 'RCD Espanyol de Barcelona' },
      { id: 3, kickoff: '2026-11-29T18:00:00Z', home: 'RCD Espanyol de Barcelona', away: 'FC Barcelona' },
      { id: 4, kickoff: '2027-03-01T20:00:00Z', home: 'Club Atlético de Madrid', away: 'Real Betis Balompié' },
    ];
    const m = matchFdcoRows(rows, fixtures);
    expect([...m.entries()]).toEqual([[0, 1], [1, 2]]);
  });
});
