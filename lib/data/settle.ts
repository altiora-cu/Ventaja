import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Fixture, FixtureAnalysis, Prediction } from '@/lib/db/types';
import { FINISHED_STATUSES } from './statuses';
import { settleOutcome, unitsFor } from './settle-rules';

export interface SettleReport {
  fixtures: number;
  settled: number;
  pending: number;
  errors: string[];
}

/**
 * Cierra picks con resultados reales → picks_history.
 * Se cierran: el pick principal del partido y todas las selecciones con Sello Alta/Media.
 */
export async function settlePicks(): Promise<SettleReport> {
  const admin = createAdminClient();
  const report: SettleReport = { fixtures: 0, settled: 0, pending: 0, errors: [] };
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString();

  const { data: fixtures } = await admin.from('fixtures').select('*').in('status', [...FINISHED_STATUSES]).gte('kickoff', since).returns<Fixture[]>();
  if (!fixtures?.length) return report;
  const ids = fixtures.map((f) => f.id);

  const [{ data: preds }, { data: analyses }, { data: done }] = await Promise.all([
    admin.from('predictions').select('*').in('fixture_id', ids).returns<Prediction[]>(),
    admin.from('fixture_analysis').select('*').in('fixture_id', ids).returns<FixtureAnalysis[]>(),
    admin.from('picks_history').select('fixture_id,market,selection,line,player_id').in('fixture_id', ids).returns<Array<{ fixture_id: number; market: string; selection: string; line: number | null; player_id: number | null }>>(),
  ]);
  const doneSet = new Set((done ?? []).map((d) => `${d.fixture_id}|${d.market}|${d.selection}|${d.line}|${d.player_id}`));
  const analysisMap = new Map((analyses ?? []).map((a) => [a.fixture_id, a]));

  for (const f of fixtures) {
    const fp = (preds ?? []).filter((p) => p.fixture_id === f.id);
    if (!fp.length) continue;
    report.fixtures++;
    const top = analysisMap.get(f.id)?.top_market;
    const toSettle = fp.filter((p) => p.sello !== 'baja' || (top && p.market === top.market && p.selection === top.selection && (p.line ?? null) === (top.line ?? null)));

    const rows = [];
    for (const p of toSettle) {
      const key = `${f.id}|${p.market}|${p.selection}|${p.line}|${p.player_id}`;
      if (doneSet.has(key)) continue;
      const result = settleOutcome({ market: p.market, selection: p.selection, line: p.line, player_id: p.player_id }, f);
      if (!result) {
        report.pending++;
        continue;
      }
      rows.push({
        fixture_id: f.id,
        market: p.market,
        selection: p.selection,
        line: p.line,
        player_id: p.player_id,
        player_name: p.player_name,
        prob: p.prob,
        price: p.best_price,
        sello: p.sello,
        result,
        units: unitsFor(result, p.best_price),
        settled_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await admin.from('picks_history').insert(rows);
      if (error) report.errors.push(`fixture ${f.id}: ${error.message}`);
      else report.settled += rows.length;
    }
  }
  return report;
}
