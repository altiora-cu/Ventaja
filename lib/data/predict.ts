import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Fixture, FixtureAnalysis, Injury, League, Odd, PlayerStats, Team, TeamStats, TopMarket } from '@/lib/db/types';
import { predictFixture, topPick, type FixtureInput, type MarketKey, type OddsQuote, type PlayerInput, type TeamInput } from '@/lib/engine';
import { generarLectura } from '@/lib/engine/lectura';
import { revisarPick, revisionEnabled } from '@/lib/engine/revision';
import { revisionKey, type RevisionFacts } from '@/lib/engine/revision-prompt';
import type { LecturaFacts } from '@/lib/engine/lectura-prompt';
import { selectionLabel } from '@/lib/labels';
import { addDays, toDateKey } from '@/lib/utils';
import { computeLeagueAverages, LEAGUE_DEFAULTS } from './aggregate';
import { activeLeagues } from './ingest';

export interface PredictReport {
  fixtures: number;
  predictions: number;
  lecturas: number;
  revisiones: number;
  errors: string[];
}

/** Máximo de revisiones IA por corrida (control de coste). */
const AI_REVIEW_MAX = Number(process.env.AI_REVIEW_MAX) || 40;

type FixtureRow = Fixture & { home: Team; away: Team; league: League };

function toTeamInput(team: Team, ts: TeamStats | undefined, missing: number): TeamInput {
  const split = (s: TeamStats['home']) => ({ played: s?.played ?? 0, gf: s?.gf ?? 0, gc: s?.gc ?? 0, xg: s?.xg ?? null, xga: s?.xga ?? null });
  const halves = ts?.halves;
  const htShare = halves && halves.ht_gf + halves.sh_gf > 0 ? halves.ht_gf / (halves.ht_gf + halves.sh_gf) : null;
  return {
    id: team.id,
    name: team.name,
    elo: ts?.elo ?? 1500,
    home: split(ts?.home ?? null),
    away: split(ts?.away ?? null),
    recent: (ts?.recent ?? []).map((r) => ({ home: r.home, gf: r.gf, gc: r.gc, xg: r.xg ?? null, xga: r.xga ?? null, result: r.result })),
    corners_for: ts?.corners_for ?? null,
    corners_against: ts?.corners_against ?? null,
    cards_for: ts?.cards_for ?? null,
    cards_against: ts?.cards_against ?? null,
    sot_for: ts?.sot_for ?? null,
    sot_against: ts?.sot_against ?? null,
    ht_share: htShare,
    missing_starters: missing,
  };
}

/** Recalcula predicciones y Lecturas de los partidos entre hoy y +3 días (o de una fecha concreta). */
export async function runPredictions(dateKey?: string): Promise<PredictReport> {
  const admin = createAdminClient();
  const report: PredictReport = { fixtures: 0, predictions: 0, lecturas: 0, revisiones: 0, errors: [] };
  const leagues = await activeLeagues(admin);

  const now = new Date();
  const from = dateKey ? new Date(`${dateKey}T00:00:00-04:00`) : new Date(now.getTime() - 2 * 3600_000);
  const to = dateKey ? new Date(`${dateKey}T23:59:59-04:00`) : addDays(now, 3);

  const { data: fixtures, error } = await admin
    .from('fixtures')
    .select('*,home:teams!fixtures_home_id_fkey(*),away:teams!fixtures_away_id_fkey(*),league:leagues(*)')
    .gte('kickoff', from.toISOString())
    .lte('kickoff', to.toISOString())
    .in('status', ['NS', 'TBD'])
    .returns<FixtureRow[]>();
  if (error) throw error;
  if (!fixtures?.length) return report;

  // Medias de liga y stats de equipos
  const leagueAvgs = new Map<number, ReturnType<typeof computeLeagueAverages>>();
  for (const league of leagues) {
    const { data: lf } = await admin.from('fixtures').select('*').eq('league_id', league.id).eq('season', league.season).returns<Fixture[]>();
    leagueAvgs.set(league.id, lf?.length ? computeLeagueAverages(lf, league.id, league.season) : LEAGUE_DEFAULTS);
  }
  const teamIds = [...new Set(fixtures.flatMap((f) => [f.home_id, f.away_id]))];
  const { data: teamStats } = await admin.from('team_stats').select('*').in('team_id', teamIds).returns<TeamStats[]>();
  const tsMap = new Map<string, TeamStats>();
  for (const ts of teamStats ?? []) tsMap.set(`${ts.team_id}:${ts.league_id}`, ts);
  const tsAny = new Map<number, TeamStats>();
  for (const ts of teamStats ?? []) if (!tsAny.has(ts.team_id) || (tsAny.get(ts.team_id)?.played ?? 0) < ts.played) tsAny.set(ts.team_id, ts);

  const fixtureIds = fixtures.map((f) => f.id);
  const [{ data: injuries }, { data: odds }, { data: players }, { data: referees }, { data: lineups }] = await Promise.all([
    admin.from('injuries').select('*').in('fixture_id', fixtureIds).returns<Injury[]>(),
    admin.from('odds').select('*').in('fixture_id', fixtureIds).returns<Odd[]>(),
    admin.from('player_stats').select('*').in('team_id', teamIds).returns<PlayerStats[]>(),
    admin.from('referees').select('*').returns<Array<{ name: string; cards_avg: number | null }>>(),
    admin.from('lineups').select('fixture_id,team_id,starters,bench').in('fixture_id', fixtureIds).returns<Array<{ fixture_id: number; team_id: number; starters: Array<{ player_id: number }>; bench: Array<{ player_id: number }> }>>(),
  ]);
  const refMap = new Map((referees ?? []).map((r) => [r.name, r.cards_avg]));

  for (const f of fixtures) {
    try {
      const fInj = (injuries ?? []).filter((i) => i.fixture_id === f.id && (i.type ?? '').toLowerCase().includes('missing'));
      const fLineups = (lineups ?? []).filter((l) => l.fixture_id === f.id);
      const starterIds = new Set(fLineups.flatMap((l) => l.starters?.map((s) => s.player_id) ?? []));
      const benchIds = new Set(fLineups.flatMap((l) => l.bench?.map((s) => s.player_id) ?? []));
      const hasLineup = (teamId: number) => fLineups.some((l) => l.team_id === teamId);

      const tsHome = tsMap.get(`${f.home_id}:${f.league_id}`) ?? tsAny.get(f.home_id);
      const tsAway = tsMap.get(`${f.away_id}:${f.league_id}`) ?? tsAny.get(f.away_id);

      const input: FixtureInput = {
        fixture_id: f.id,
        home: toTeamInput(f.home, tsHome, fInj.filter((i) => i.team_id === f.home_id).length),
        away: toTeamInput(f.away, tsAway, fInj.filter((i) => i.team_id === f.away_id).length),
        league: leagueAvgs.get(f.league_id) ?? LEAGUE_DEFAULTS,
        referee_cards_avg: f.referee ? refMap.get(f.referee.split(',')[0].trim()) ?? null : null,
        players: (players ?? [])
          .filter((p) => p.team_id === f.home_id || p.team_id === f.away_id)
          .map<PlayerInput>((p) => ({
            id: p.player_id,
            name: p.name,
            team_id: p.team_id,
            minutes: p.minutes,
            appearances: p.appearances,
            lineups: p.lineups,
            goals: p.goals,
            shots: p.shots,
            sot: p.sot,
            xg: p.xg,
            starter: hasLineup(p.team_id) ? (starterIds.has(p.player_id) ? true : benchIds.has(p.player_id) ? false : false) : null,
          })),
      };

      const quotes: OddsQuote[] = (odds ?? [])
        .filter((o) => o.fixture_id === f.id)
        .map((o) => ({ bookmaker: o.bookmaker, market: o.market as MarketKey, selection: o.selection, line: o.line, price: Number(o.price) }));

      const result = predictFixture(input, quotes);
      const pick = topPick(result.priced);

      // Guardar predicciones (reemplazo completo)
      await admin.from('predictions').delete().eq('fixture_id', f.id);
      const rows = result.priced.map((p) => ({
        fixture_id: f.id,
        market: p.market,
        selection: p.selection,
        line: p.line,
        player_id: p.player_id ?? null,
        player_name: p.player_name ?? null,
        prob: round(p.prob),
        best_price: p.best_price,
        best_bookmaker: p.best_bookmaker,
        implied_prob: p.implied_prob === null ? null : round(p.implied_prob),
        edge: p.edge === null ? null : round(p.edge),
        sello: p.sello,
        calculated_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error: insErr } = await admin.from('predictions').insert(rows.slice(i, i + 500));
        if (insErr) throw insErr;
      }
      report.predictions += rows.length;

      // Lectura: cachear por fixture; regenerar solo si cambia el Sello del pick principal
      const { data: prev } = await admin.from('fixture_analysis').select('*').eq('fixture_id', f.id).maybeSingle<FixtureAnalysis>();
      const topMarket: TopMarket | null = pick
        ? { market: pick.market, selection: pick.selection, line: pick.line, player_name: pick.player_name ?? null, prob: round(pick.prob), best_price: pick.best_price, best_bookmaker: pick.best_bookmaker, edge: pick.edge === null ? null : round(pick.edge), sello: pick.sello }
        : null;
      let lectura = prev?.lectura ?? null;
      let lecturaEn = prev?.lectura_en ?? null;
      const selloChanged = !prev?.lectura || prev.lectura_sello !== (pick?.sello ?? null);
      if (pick && selloChanged) {
        const facts = buildFacts(f, input, result, pick, tsHome, tsAway);
        const [es, en] = await Promise.all([generarLectura(facts, 'es'), generarLectura(facts, 'en')]);
        lectura = es.text;
        lecturaEn = en.text;
        report.lecturas++;
      }

      // Revisión IA del pick principal (solo con cuota; cacheada por clave de contexto)
      let aiReview = prev?.ai_review ?? null;
      if (pick && pick.best_price && revisionEnabled()) {
        const rfacts = buildRevisionFacts(f, input, result, pick, tsHome, tsAway, fInj, quotes.length ? new Set(quotes.map((q) => q.bookmaker)).size : 0, refMap);
        const key = revisionKey(rfacts);
        if ((!aiReview || aiReview.key !== key) && report.revisiones < AI_REVIEW_MAX) {
          const r = await revisarPick(rfacts);
          if (r) {
            aiReview = r;
            report.revisiones++;
          }
        }
      } else if (!pick) {
        aiReview = null;
      }

      await admin.from('fixture_analysis').upsert(
        {
          fixture_id: f.id,
          lambda_home: round(result.lambda_home, 3),
          lambda_away: round(result.lambda_away, 3),
          scores: result.scores.map((s) => ({ ...s, prob: round(s.prob) })),
          lectura,
          lectura_en: lecturaEn,
          lectura_locale: 'es',
          lectura_sello: pick?.sello ?? null,
          top_market: topMarket,
          ai_review: aiReview,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'fixture_id' },
      );
      report.fixtures++;
    } catch (e) {
      report.errors.push(`fixture ${f.id}: ${(e as Error).message}`);
    }
  }
  return report;
}

function round(n: number, d = 4): number {
  const m = 10 ** d;
  return Math.round(n * m) / m;
}

function buildFacts(
  f: FixtureRow,
  input: FixtureInput,
  result: ReturnType<typeof predictFixture>,
  pick: NonNullable<ReturnType<typeof topPick>>,
  tsHome?: TeamStats,
  tsAway?: TeamStats,
): LecturaFacts {
  const get = (market: string, selection: string, line: number | null = null) => result.priced.find((p) => p.market === market && p.selection === selection && (line === null ? p.line === null : p.line === line))?.prob ?? 0;
  const pg = (ts?: TeamStats) => (ts && ts.played > 0 ? ts.gf / ts.played : 0);
  const xgpg = (ts?: TeamStats) => (ts && ts.played > 0 && ts.xg !== null ? ts.xg / ts.played : null);
  return {
    home: f.home.name,
    away: f.away.name,
    league: f.league.name,
    homeForm: tsHome?.form ?? '',
    awayForm: tsAway?.form ?? '',
    homeGoalsPerGame: pg(tsHome),
    awayGoalsPerGame: pg(tsAway),
    homeXg: xgpg(tsHome),
    awayXg: xgpg(tsAway),
    homeMissing: input.home.missing_starters,
    awayMissing: input.away.missing_starters,
    probHome: get('1x2', 'home'),
    probDraw: get('1x2', 'draw'),
    probAway: get('1x2', 'away'),
    probOver25: get('totals', 'over', 2.5),
    topMarketLabel: selectionLabel(pick.market, pick.selection, pick.line, { home: f.home.name, away: f.away.name, player: pick.player_name }, 'es'),
    topMarketProb: pick.prob,
    topMarketPrice: pick.best_price,
    topMarketEdge: pick.edge,
    sello: pick.sello,
  };
}

function buildRevisionFacts(
  f: FixtureRow,
  input: FixtureInput,
  result: ReturnType<typeof predictFixture>,
  pick: NonNullable<ReturnType<typeof topPick>>,
  tsHome: TeamStats | undefined,
  tsAway: TeamStats | undefined,
  injuries: Injury[],
  bookmakers: number,
  refMap: Map<string, number | null>,
): RevisionFacts {
  const get = (market: string, selection: string) => result.priced.find((p) => p.market === market && p.selection === selection && p.line === null)?.prob ?? 0;
  const xgpg = (ts?: TeamStats) => (ts && ts.played > 0 && ts.xg !== null ? ts.xg / ts.played : null);
  const refName = f.referee ? f.referee.split(',')[0].trim() : null;
  return {
    home: f.home.name,
    away: f.away.name,
    league: f.league.name,
    kickoff: new Intl.DateTimeFormat('es-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(f.kickoff)) + ' ET',
    pickLabel: selectionLabel(pick.market, pick.selection, pick.line, { home: f.home.name, away: f.away.name, player: pick.player_name }, 'es'),
    pickProb: pick.prob,
    pickPrice: pick.best_price,
    pickEdge: pick.edge,
    selloModelo: pick.sello,
    lambdaHome: result.lambda_home,
    lambdaAway: result.lambda_away,
    probHome: get('1x2', 'home'),
    probDraw: get('1x2', 'draw'),
    probAway: get('1x2', 'away'),
    homeForm: tsHome?.form ?? '',
    awayForm: tsAway?.form ?? '',
    homePlayed: tsHome?.played ?? 0,
    awayPlayed: tsAway?.played ?? 0,
    homeXgPerGame: xgpg(tsHome),
    awayXgPerGame: xgpg(tsAway),
    homeMissing: injuries.filter((i) => i.team_id === f.home_id).map((i) => i.player_name ?? '').filter(Boolean).slice(0, 6),
    awayMissing: injuries.filter((i) => i.team_id === f.away_id).map((i) => i.player_name ?? '').filter(Boolean).slice(0, 6),
    bookmakers,
    referee: refName,
    refereeCards: refName ? refMap.get(refName) ?? null : null,
  };
}

/** Utilidad para el botón de admin: hoy en ET. */
export function todayKey(): string {
  return toDateKey(new Date());
}

export type { SupabaseClient };
