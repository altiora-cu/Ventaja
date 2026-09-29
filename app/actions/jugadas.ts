'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth/viewer';
import type { Fixture, Prediction, UserComboKind } from '@/lib/db/types';
import { selectionKey } from '@/lib/engine/edge';

export interface PlayActionResult {
  ok: boolean;
  /** Estado final de la jugada tras la acción. */
  marked?: boolean;
  error?: string;
}

const MIN_COMBO_LEGS = 2;
const MAX_COMBO_LEGS = 8;
const COMBO_KINDS: readonly UserComboKind[] = ['propia', 'segura', 'equilibrada', 'ambiciosa'];
const OPEN_STATUSES = ['NS', 'TBD'];

const ERRORS = {
  auth: 'Inicia sesión para guardar tus jugadas.',
  access: 'Tu cuenta no tiene acceso activo.',
  invalid: 'Datos inválidos.',
  notFound: 'La jugada ya no está disponible.',
  started: 'El partido ya empezó: no se puede marcar ni quitar.',
  settled: 'La jugada ya tiene resultado y no se puede quitar.',
  sameFixture: 'Una combinada no puede repetir partido.',
  generic: 'No se pudo guardar. Inténtalo de nuevo.',
} as const;

type PlayFixture = Pick<Fixture, 'id' | 'status' | 'kickoff'>;

/**
 * Las tablas de jugadas no aceptan escrituras del cliente (ver migración 0005). Cada escritura usa
 * service_role, siempre después de validar y siempre con el user_id de la sesión.
 */
function writer() {
  return createAdminClient();
}

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.user) return { error: ERRORS.auth };
  if (!viewer.access.canAccess) return { error: ERRORS.access };
  return { userId: viewer.user.id };
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

function isOpen(f: PlayFixture): boolean {
  return OPEN_STATUSES.includes(f.status) && new Date(f.kickoff).getTime() > Date.now();
}

/** Los valores de la jugada se leen de la base de datos; del cliente solo llega el id de la predicción. */
function pickRow(userId: string, p: Prediction, comboId: number | null) {
  return {
    user_id: userId,
    combo_id: comboId,
    fixture_id: p.fixture_id,
    market: p.market,
    selection: p.selection,
    line: p.line,
    player_id: p.player_id,
    player_name: p.player_name,
    prob: p.prob,
    price: p.best_price,
    sello: p.sello,
  };
}

function legKey(l: Pick<Prediction, 'fixture_id' | 'market' | 'selection' | 'line' | 'player_id'>): string {
  return `${l.fixture_id}|${selectionKey(l.market, l.selection, l.line === null ? null : Number(l.line), l.player_id)}`;
}

/** true si el usuario ya tiene pendiente una combinada con exactamente estas selecciones. */
async function hasPendingCombo(supabase: ReturnType<typeof createClient>, userId: string, preds: Prediction[]): Promise<boolean> {
  const { data: combos } = await supabase.from('user_combos').select('id').eq('user_id', userId).is('result', null).returns<Array<{ id: number }>>();
  if (!combos?.length) return false;
  const { data: legs } = await supabase
    .from('user_picks')
    .select('combo_id,fixture_id,market,selection,line,player_id')
    .eq('user_id', userId)
    .in('combo_id', combos.map((c) => c.id))
    .returns<Array<Pick<Prediction, 'fixture_id' | 'market' | 'selection' | 'line' | 'player_id'> & { combo_id: number }>>();
  const byCombo = new Map<number, string[]>();
  for (const l of legs ?? []) byCombo.set(l.combo_id, [...(byCombo.get(l.combo_id) ?? []), legKey(l)]);
  const wanted = preds.map(legKey).sort().join(',');
  return [...byCombo.values()].some((keys) => [...keys].sort().join(',') === wanted);
}

function revalidatePlays(fixtureIds: number[]): void {
  revalidatePath('/mis-jugadas');
  revalidatePath('/picks');
  for (const id of new Set(fixtureIds)) revalidatePath(`/partido/${id}`);
}

/** Marca o desmarca una jugada suelta. */
export async function togglePlay(predictionId: number): Promise<PlayActionResult> {
  try {
    if (!isPositiveInt(predictionId)) return { ok: false, error: ERRORS.invalid };
    const auth = await requireUserId();
    if ('error' in auth) return { ok: false, error: auth.error };
    const supabase = createClient();

    const { data: pred } = await supabase.from('predictions').select('*').eq('id', predictionId).maybeSingle<Prediction>();
    if (!pred) return { ok: false, error: ERRORS.notFound };
    const { data: fixture } = await supabase.from('fixtures').select('id,status,kickoff').eq('id', pred.fixture_id).maybeSingle<PlayFixture>();
    if (!fixture) return { ok: false, error: ERRORS.notFound };
    if (!isOpen(fixture)) return { ok: false, error: ERRORS.started };

    let existing = supabase.from('user_picks').select('id,result').eq('user_id', auth.userId).eq('fixture_id', pred.fixture_id).eq('market', pred.market).eq('selection', pred.selection).is('combo_id', null);
    existing = pred.line === null ? existing.is('line', null) : existing.eq('line', pred.line);
    existing = pred.player_id === null ? existing.is('player_id', null) : existing.eq('player_id', pred.player_id);
    const { data: current } = await existing.maybeSingle<{ id: number; result: string | null }>();

    if (current) {
      if (current.result !== null) return { ok: false, marked: true, error: ERRORS.settled };
      const { error } = await writer().from('user_picks').delete().eq('id', current.id).eq('user_id', auth.userId).is('result', null);
      if (error) return { ok: false, marked: true, error: ERRORS.generic };
      revalidatePlays([pred.fixture_id]);
      return { ok: true, marked: false };
    }

    const { error } = await writer().from('user_picks').insert(pickRow(auth.userId, pred, null));
    // 23505: otra pestaña la marcó a la vez; el resultado es el mismo.
    if (error && error.code !== '23505') return { ok: false, marked: false, error: ERRORS.generic };
    revalidatePlays([pred.fixture_id]);
    return { ok: true, marked: true };
  } catch (e) {
    console.error('[jugadas:togglePlay]', e);
    return { ok: false, error: ERRORS.generic };
  }
}

/** Guarda una combinada con las predicciones indicadas (una por partido). */
export async function saveCombo(predictionIds: number[], kind: UserComboKind = 'propia'): Promise<PlayActionResult> {
  try {
    const ids = Array.isArray(predictionIds) ? [...new Set(predictionIds)] : [];
    if (ids.length < MIN_COMBO_LEGS || ids.length > MAX_COMBO_LEGS || !ids.every(isPositiveInt) || !COMBO_KINDS.includes(kind)) return { ok: false, error: ERRORS.invalid };
    const auth = await requireUserId();
    if ('error' in auth) return { ok: false, error: auth.error };
    const supabase = createClient();

    const { data: preds } = await supabase.from('predictions').select('*').in('id', ids).returns<Prediction[]>();
    if (!preds || preds.length !== ids.length) return { ok: false, error: ERRORS.notFound };
    const fixtureIds = preds.map((p) => p.fixture_id);
    if (new Set(fixtureIds).size !== fixtureIds.length) return { ok: false, error: ERRORS.sameFixture };
    const { data: fixtures } = await supabase.from('fixtures').select('id,status,kickoff').in('id', fixtureIds).returns<PlayFixture[]>();
    if (!fixtures || fixtures.length !== fixtureIds.length) return { ok: false, error: ERRORS.notFound };
    if (!fixtures.every(isOpen)) return { ok: false, error: ERRORS.started };

    if (await hasPendingCombo(supabase, auth.userId, preds)) return { ok: true, marked: true };

    const jointProb = preds.reduce((acc, p) => acc * Number(p.prob), 1);
    const totalPrice = preds.every((p) => p.best_price) ? preds.reduce((acc, p) => acc * Number(p.best_price), 1) : null;
    const admin = writer();
    const { data: combo, error: comboErr } = await admin
      .from('user_combos')
      .insert({ user_id: auth.userId, kind, joint_prob: jointProb, total_price: totalPrice })
      .select('id')
      .single<{ id: number }>();
    if (comboErr || !combo) return { ok: false, error: ERRORS.generic };

    const { error: legsErr } = await admin.from('user_picks').insert(preds.map((p) => pickRow(auth.userId, p, combo.id)));
    if (legsErr) {
      // Sin selecciones la combinada no tiene sentido: se deshace.
      await admin.from('user_combos').delete().eq('id', combo.id).eq('user_id', auth.userId);
      return { ok: false, error: ERRORS.generic };
    }
    revalidatePlays(fixtureIds);
    return { ok: true, marked: true };
  } catch (e) {
    console.error('[jugadas:saveCombo]', e);
    return { ok: false, error: ERRORS.generic };
  }
}

/** Quita una jugada suelta o una combinada que sigue pendiente. */
export async function removePlay(kind: 'jugada' | 'combinada', id: number): Promise<PlayActionResult> {
  try {
    if (!isPositiveInt(id) || (kind !== 'jugada' && kind !== 'combinada')) return { ok: false, error: ERRORS.invalid };
    const auth = await requireUserId();
    if ('error' in auth) return { ok: false, error: auth.error };
    const supabase = createClient();
    const table = kind === 'jugada' ? 'user_picks' : 'user_combos';

    const { data: row } = await supabase.from(table).select('id,result').eq('id', id).eq('user_id', auth.userId).maybeSingle<{ id: number; result: string | null }>();
    if (!row) return { ok: false, error: ERRORS.notFound };
    if (row.result !== null) return { ok: false, error: ERRORS.settled };

    // Solo se puede quitar antes del pitazo: así el porcentaje no se mejora borrando jugadas que van perdiendo.
    let legs = supabase.from('user_picks').select('fixture_id');
    legs = kind === 'jugada' ? legs.eq('id', id).is('combo_id', null) : legs.eq('combo_id', id);
    const { data: legRows } = await legs.eq('user_id', auth.userId).returns<Array<{ fixture_id: number }>>();
    if (!legRows?.length) return { ok: false, error: ERRORS.notFound };
    const { data: fixtures } = await supabase.from('fixtures').select('id,status,kickoff').in('id', legRows.map((l) => l.fixture_id)).returns<PlayFixture[]>();
    if (!fixtures?.length || !fixtures.every(isOpen)) return { ok: false, error: ERRORS.started };

    const { error } = await writer().from(table).delete().eq('id', id).eq('user_id', auth.userId).is('result', null);
    if (error) return { ok: false, error: ERRORS.generic };
    revalidatePlays([]);
    return { ok: true, marked: false };
  } catch (e) {
    console.error('[jugadas:removePlay]', e);
    return { ok: false, error: ERRORS.generic };
  }
}
