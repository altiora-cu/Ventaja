import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Fixture, FixtureAnalysis, FixtureFull, PickResult, Prediction, SystemCombo, SystemComboSelection, UserCombo, UserPick } from '@/lib/db/types';
import { buildCombos, type ComboSelection } from '@/lib/engine/combos';
import { selectionKey } from '@/lib/engine/edge';
import { DEFAULT_TZ, zonedStartOfDay } from '@/lib/tz';
import { toDateKey } from '@/lib/utils';
import { comboUnits, settleCombo } from './combo-rules';
import { isVoidFixture, settleOutcome, unitsFor, type SettleInput } from './settle-rules';
import { FINISHED_STATUSES, POSTPONED_STATUSES } from './statuses';

const DAY_MS = 86_400_000;
const PAGE = 500;

export interface UserSettleReport {
  picksSettled: number;
  picksPending: number;
  combosSettled: number;
  systemCombosSettled: number;
  errors: string[];
}

export interface ComboRegisterReport {
  dateKey: string;
  registered: number;
  skipped: number;
  errors: string[];
}

/** Partidos ya resueltos: terminados, o cancelados/aplazados (estos últimos pueden anular la jugada). */
async function resolvedFixtures(admin: SupabaseClient, ids: number[]): Promise<Map<number, Fixture>> {
  const out = new Map<number, Fixture>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += PAGE) {
    const { data, error } = await admin
      .from('fixtures')
      .select('*')
      .in('id', unique.slice(i, i + PAGE))
      .in('status', [...FINISHED_STATUSES, ...POSTPONED_STATUSES])
      .returns<Fixture[]>();
    if (error) throw error;
    for (const f of data ?? []) out.set(f.id, f);
  }
  return out;
}

/** Resultado de una selección: nula si el partido no se jugó; si no, según el marcador y las estadísticas. */
function resolveSelection(sel: SettleInput, fixture: Fixture | undefined): PickResult | null {
  if (!fixture) return null;
  if (isVoidFixture(fixture)) return 'nulo';
  if (!FINISHED_STATUSES.has(fixture.status)) return null;
  return settleOutcome(sel, fixture);
}

/** Cierra las jugadas de usuario (sueltas y selecciones de combinadas) cuyos partidos ya terminaron. */
async function settleUserPicks(admin: SupabaseClient, report: UserSettleReport): Promise<void> {
  const { data: pending, error } = await admin.from('user_picks').select('*').is('result', null).limit(5000).returns<UserPick[]>();
  if (error) throw error;
  if (!pending?.length) return;
  const fixtures = await resolvedFixtures(admin, pending.map((p) => p.fixture_id));
  const settledAt = new Date().toISOString();

  for (const p of pending) {
    const result = resolveSelection({ market: p.market, selection: p.selection, line: p.line === null ? null : Number(p.line), player_id: p.player_id }, fixtures.get(p.fixture_id));
    if (!result) {
      report.picksPending++;
      continue;
    }
    const units = p.combo_id === null ? unitsFor(result, p.price === null ? null : Number(p.price)) : 0;
    const { error: updErr } = await admin.from('user_picks').update({ result, units, settled_at: settledAt }).eq('id', p.id);
    if (updErr) report.errors.push(`user_pick ${p.id}: ${updErr.message}`);
    else report.picksSettled++;
  }
}

/** Cierra las combinadas de usuario a partir del resultado de sus selecciones. */
async function settleUserCombos(admin: SupabaseClient, report: UserSettleReport): Promise<void> {
  const { data: combos, error } = await admin.from('user_combos').select('*').is('result', null).limit(2000).returns<UserCombo[]>();
  if (error) throw error;
  if (!combos?.length) return;
  const { data: legs, error: legErr } = await admin
    .from('user_picks')
    .select('combo_id,user_id,result,price')
    .in('combo_id', combos.map((c) => c.id))
    .returns<Array<{ combo_id: number; user_id: string; result: PickResult | null; price: number | null }>>();
  if (legErr) throw legErr;
  const settledAt = new Date().toISOString();

  for (const combo of combos) {
    const comboLegs = (legs ?? []).filter((l) => l.combo_id === combo.id && l.user_id === combo.user_id).map((l) => ({ result: l.result, price: l.price === null ? null : Number(l.price) }));
    const result = settleCombo(comboLegs);
    if (!result) continue;
    const { error: updErr } = await admin.from('user_combos').update({ result, units: comboUnits(result, comboLegs), settled_at: settledAt }).eq('id', combo.id);
    if (updErr) report.errors.push(`user_combo ${combo.id}: ${updErr.message}`);
    else report.combosSettled++;
  }
}

/** Cierra las combinadas del sistema y guarda el resultado de cada selección. */
async function settleSystemCombos(admin: SupabaseClient, report: UserSettleReport): Promise<void> {
  const { data: combos, error } = await admin.from('system_combos').select('*').is('result', null).limit(500).returns<SystemCombo[]>();
  if (error) throw error;
  if (!combos?.length) return;
  const fixtures = await resolvedFixtures(admin, combos.flatMap((c) => c.selections.map((s) => s.fixture_id)));

  for (const combo of combos) {
    const selections: SystemComboSelection[] = combo.selections.map((s) => {
      const result = s.result ?? resolveSelection({ market: s.market, selection: s.selection, line: s.line, player_id: s.player_id }, fixtures.get(s.fixture_id));
      return { ...s, result };
    });
    const changed = selections.some((s, i) => s.result !== combo.selections[i].result);
    const result = settleCombo(selections);
    if (!changed && !result) continue;
    const patch = result ? { selections, result, units: comboUnits(result, selections), settled_at: new Date().toISOString() } : { selections };
    const { error: updErr } = await admin.from('system_combos').update(patch).eq('id', combo.id);
    if (updErr) report.errors.push(`system_combo ${combo.id}: ${updErr.message}`);
    else if (result) report.systemCombosSettled++;
  }
}

/** Cierre de todo lo que depende de resultados además de picks_history. Cada bloque captura su error. */
export async function settleUserPlays(): Promise<UserSettleReport> {
  const admin = createAdminClient();
  const report: UserSettleReport = { picksSettled: 0, picksPending: 0, combosSettled: 0, systemCombosSettled: 0, errors: [] };
  const steps: Array<[string, (a: SupabaseClient, r: UserSettleReport) => Promise<void>]> = [
    ['user_picks', settleUserPicks],
    ['user_combos', settleUserCombos],
    ['system_combos', settleSystemCombos],
  ];
  for (const [name, step] of steps) {
    try {
      await step(admin, report);
    } catch (e) {
      report.errors.push(`${name}: ${(e as Error).message}`);
    }
  }
  return report;
}

/**
 * Guarda las combinadas que el sistema propone para un día. Solo inserta: la primera versión del día es
 * la que queda registrada, para que el historial no se pueda reescribir después de conocer resultados.
 */
export async function registerSystemCombos(dateKey = toDateKey(new Date(), DEFAULT_TZ)): Promise<ComboRegisterReport> {
  const admin = createAdminClient();
  const report: ComboRegisterReport = { dateKey, registered: 0, skipped: 0, errors: [] };
  const from = zonedStartOfDay(dateKey, DEFAULT_TZ);
  const to = new Date(from.getTime() + DAY_MS);

  const { data: fixtures, error } = await admin
    .from('fixtures')
    .select('*,home:teams!fixtures_home_id_fkey(*),away:teams!fixtures_away_id_fkey(*),league:leagues(*)')
    .gte('kickoff', from.toISOString())
    .lt('kickoff', to.toISOString())
    .gt('kickoff', new Date().toISOString())
    .in('status', ['NS', 'TBD'])
    .returns<FixtureFull[]>();
  if (error) throw error;
  if (!fixtures?.length) return report;
  const fixtureMap = new Map(fixtures.map((f) => [f.id, f]));

  const { data: preds, error: predErr } = await admin
    .from('predictions')
    .select('*')
    .in('fixture_id', fixtures.map((f) => f.id))
    .gte('edge', 0.05)
    .gte('prob', 0.55)
    .not('best_price', 'is', null)
    .returns<Prediction[]>();
  if (predErr) throw predErr;

  // Las jugadas que la Revisión IA contradice no entran en las combinadas.
  const { data: analyses } = await admin.from('fixture_analysis').select('fixture_id,ai_review').in('fixture_id', fixtures.map((f) => f.id)).returns<Array<Pick<FixtureAnalysis, 'fixture_id' | 'ai_review'>>>();
  const rejected = new Set((analyses ?? []).flatMap((a) => (a.ai_review?.plays ?? []).filter((r) => r.verdict === 'discrepa').map((r) => `${a.fixture_id}|${r.key}`)));
  const accepted = (preds ?? []).filter((p) => !rejected.has(`${p.fixture_id}|${selectionKey(p.market, p.selection, p.line === null ? null : Number(p.line), p.player_id)}`));

  const candidates: Array<ComboSelection & { player_id: number | null }> = accepted.map((p) => ({
    fixture_id: p.fixture_id,
    market: p.market,
    selection: p.selection,
    line: p.line === null ? null : Number(p.line),
    player_id: p.player_id,
    player_name: p.player_name,
    prob: Number(p.prob),
    price: Number(p.best_price),
    edge: Number(p.edge),
    sello: p.sello,
  }));

  const combos = buildCombos(candidates);
  for (const combo of Object.values(combos)) {
    if (!combo) {
      report.skipped++;
      continue;
    }
    const selections: SystemComboSelection[] = (combo.selections as Array<ComboSelection & { player_id: number | null }>).map((s) => {
      const f = fixtureMap.get(s.fixture_id)!;
      return {
        fixture_id: s.fixture_id,
        market: s.market,
        selection: s.selection,
        line: s.line,
        player_id: s.player_id ?? null,
        player_name: s.player_name ?? null,
        prob: s.prob,
        price: s.price,
        sello: s.sello,
        home: f.home.name,
        away: f.away.name,
        league: f.league.name,
        kickoff: f.kickoff,
        result: null,
      };
    });
    const { error: insErr, data: inserted } = await admin
      .from('system_combos')
      .upsert({ date_key: dateKey, kind: combo.kind, selections, joint_prob: combo.jointProb, total_price: combo.totalPrice }, { onConflict: 'date_key,kind', ignoreDuplicates: true })
      .select('id');
    if (insErr) report.errors.push(`${combo.kind}: ${insErr.message}`);
    else if (inserted?.length) report.registered++;
    else report.skipped++;
  }
  return report;
}
