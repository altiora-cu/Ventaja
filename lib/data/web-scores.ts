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
  errors: string[];
}

const WEB_SCORES_MAX = Number(process.env.WEB_SCORES_MAX) || 12;
const DAY_MS = 86_400_000;
const STALE_AFTER_DAYS = 3;
const WINDOW_DAYS = 30;
const RETRY_AFTER_MS = 3 * DAY_MS;

type StaleRow = { id: number; kickoff: string; league: { name: string }; home: { name: string }; away: { name: string } };

/**
 * Red de seguridad de resultados: The Odds API solo devuelve marcadores de 3 días atrás. Lo que quede
 * sin cerrar después de eso lo busca la IA en la web (máximo 2 búsquedas por partido) y lo carga solo si
 * lo confirma con confianza alta y fuente. La fuente queda en ingest_log (clave web-score:<id>).
 * Coste aproximado: 2 búsquedas (~0.02 USD) más tokens de Haiku por partido.
 */
export async function runWebScores(now = new Date()): Promise<WebScoresReport> {
  const report: WebScoresReport = { enabled: webScoresEnabled(), stale: 0, asked: 0, updated: 0, postponed: 0, unresolved: 0, skippedRecent: 0, errors: [] };
  if (!report.enabled) return report;
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('fixtures')
    .select('id,kickoff,league:leagues(name),home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name)')
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
