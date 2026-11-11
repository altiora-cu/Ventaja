import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { buscarMarcadorWeb, webScoresEnabled } from '@/lib/engine/web-scores';
import { markFetched, shouldFetch } from './cache';

export interface WebScoresReport {
  enabled: boolean;
  /** Partidos con más de 3 días sin marcador que entraban en la ventana. */
  stale: number;
  /** Consultados en esta corrida (tope WEB_SCORES_MAX). */
  asked: number;
  updated: number;
  postponed: number;
  /** La IA no confirmó el marcador: se reintenta a los 3 días. */
  unresolved: number;
  skippedRecent: number;
  /** Huérfanos de una reprogramación (mismo cruce ya existe con otra fecha) borrados en vez de buscados. */
  duplicatesRemoved: number;
  /** Huérfanos con jugadas marcadas: se les copió el resultado del partido gemelo. */
  duplicatesSettled: number;
  errors: string[];
}

const WEB_SCORES_MAX = Number(process.env.WEB_SCORES_MAX) || 12;
const DAY_MS = 86_400_000;
const STALE_AFTER_DAYS = 3;
const WINDOW_DAYS = 30;
const RETRY_AFTER_MS = 3 * DAY_MS;
const TWIN_WINDOW_DAYS = 7;

type StaleRow = { id: number; kickoff: string; league_id: number; home_id: number; away_id: number; league: { name: string }; home: { name: string }; away: { name: string } };
type TwinRow = { id: number; kickoff: string; status: string; home_goals: number | null; away_goals: number | null };

/**
 * Un partido sin marcador cuyo mismo cruce existe con otra fecha a ≤ 7 días es un huérfano de reprogramación
 * (The Odds API cambió el id del evento antes del arreglo de lib/data/reschedule.ts). Buscarle marcador lo
 * convertiría en un duplicado que cuenta doble en la forma y el Historial.
 */
async function findTwin(admin: ReturnType<typeof createAdminClient>, f: StaleRow): Promise<TwinRow | null> {
  const k = new Date(f.kickoff).getTime();
  const { data } = await admin
    .from('fixtures')
    .select('id,kickoff,status,home_goals,away_goals')
    .eq('league_id', f.league_id)
    .eq('home_id', f.home_id)
    .eq('away_id', f.away_id)
    .neq('id', f.id)
    .gte('kickoff', new Date(k - TWIN_WINDOW_DAYS * DAY_MS).toISOString())
    .lte('kickoff', new Date(k + TWIN_WINDOW_DAYS * DAY_MS).toISOString())
    .order('kickoff')
    .limit(1)
    .returns<TwinRow[]>();
  return data?.[0] ?? null;
}

/**
 * Red de seguridad de resultados: The Odds API solo devuelve marcadores de 3 días atrás. Lo que quede
 * sin cerrar después de eso lo busca la IA en la web (máximo 2 búsquedas por partido) y lo carga solo si
 * lo confirma con confianza alta y fuente. La fuente queda en ingest_log (clave web-score:<id>).
 * Coste aproximado: 2 búsquedas (~0.02 USD) más tokens de Haiku por partido.
 */
export async function runWebScores(now = new Date()): Promise<WebScoresReport> {
  const report: WebScoresReport = { enabled: webScoresEnabled(), stale: 0, asked: 0, updated: 0, postponed: 0, unresolved: 0, skippedRecent: 0, duplicatesRemoved: 0, duplicatesSettled: 0, errors: [] };
  if (!report.enabled) return report;
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('fixtures')
    .select('id,kickoff,league_id,home_id,away_id,league:leagues(name),home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name)')
    .not('status', 'in', '("FT","AET","PEN","PST","CANC","AWD")')
    .lte('kickoff', new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS).toISOString())
    .gte('kickoff', new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString())
    .order('kickoff', { ascending: false })
    .limit(200)
    .returns<StaleRow[]>();
  if (error) throw error;
  report.stale = rows?.length ?? 0;

  for (const f of rows ?? []) {
    if (report.asked >= WEB_SCORES_MAX) break;
    const key = `web-score:${f.id}`;
    try {
      const twin = await findTwin(admin, f);
      if (twin) {
        const { count } = await admin.from('user_picks').select('id', { count: 'exact', head: true }).eq('fixture_id', f.id);
        if (!count) {
          const { error: delErr } = await admin.from('fixtures').delete().eq('id', f.id);
          if (delErr) throw delErr;
          report.duplicatesRemoved++;
          console.log(`[web-scores] #${f.id} ${f.home.name} vs ${f.away.name} (${f.kickoff.slice(0, 10)}): huérfano de reprogramación, borrado; el partido real es #${twin.id} (${twin.kickoff.slice(0, 10)})`);
          continue;
        }
        if (twin.status === 'FT' && twin.home_goals !== null && twin.away_goals !== null) {
          const { error: updErr } = await admin.from('fixtures').update({ status: 'FT', home_goals: twin.home_goals, away_goals: twin.away_goals, updated_at: now.toISOString() }).eq('id', f.id);
          if (updErr) throw updErr;
          report.duplicatesSettled++;
          console.warn(`[web-scores] #${f.id} ${f.home.name} vs ${f.away.name}: huérfano con jugadas marcadas; se copió el marcador de #${twin.id} (${twin.home_goals}-${twin.away_goals}). Revisar duplicado a mano.`);
        }
        // Gemelo aún sin jugar: se espera a que tenga resultado.
        continue;
      }
    } catch (e) {
      report.errors.push(`#${f.id} gemelo: ${(e as Error).message}`);
      continue;
    }
    if (!(await shouldFetch(admin, key, RETRY_AFTER_MS))) {
      report.skippedRecent++;
      continue;
    }
    report.asked++;
    try {
      const score = await buscarMarcadorWeb({ home: f.home.name, away: f.away.name, league: f.league.name, kickoffIso: f.kickoff });
      if (!score) {
        report.unresolved++;
        await markFetched(admin, key, 'sin confirmar', 0);
        continue;
      }
      const patch = score.status === 'FT' ? { status: 'FT', home_goals: score.home_goals, away_goals: score.away_goals } : { status: score.status };
      const { error: updErr } = await admin.from('fixtures').update({ ...patch, updated_at: now.toISOString() }).eq('id', f.id);
      if (updErr) throw updErr;
      if (score.status === 'FT') report.updated++;
      else report.postponed++;
      const note = score.status === 'FT' ? `${score.home_goals}-${score.away_goals} (${f.home.name} vs ${f.away.name}) · ${score.sources[0]}` : `${score.status} · ${score.sources[0]}`;
      await markFetched(admin, key, note.slice(0, 300), score.sources.length);
      console.log(`[web-scores] #${f.id} ${f.home.name} vs ${f.away.name}: ${note}`);
    } catch (e) {
      report.errors.push(`#${f.id}: ${(e as Error).message}`);
    }
  }
  return report;
}
