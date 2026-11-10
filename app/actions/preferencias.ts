'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getViewer } from '@/lib/auth/viewer';
import { isCurrency, MAX_STAKE } from '@/lib/engine/money';

export interface PreferencesInput {
  currency?: unknown;
  defaultStake?: unknown;
  notifyKickoff?: unknown;
  notifyResults?: unknown;
}

export interface PreferencesResult {
  ok: boolean;
  error?: string;
}

const ERRORS = {
  auth: 'Inicia sesión para cambiar tus preferencias.',
  invalid: 'Datos inválidos.',
  stake: 'El stake debe ser mayor que 0 y como máximo 100 000.',
  generic: 'No se pudo guardar. Inténtalo de nuevo.',
} as const;

/** Moneda, stake por defecto y avisos. Solo campos que el trigger de protección del perfil deja cambiar. */
export async function updatePreferences(input: PreferencesInput): Promise<PreferencesResult> {
  try {
    const viewer = await getViewer();
    if (!viewer.user) return { ok: false, error: ERRORS.auth };
    const patch: Record<string, unknown> = {};
    if (input.currency !== undefined) {
      if (!isCurrency(input.currency)) return { ok: false, error: ERRORS.invalid };
      patch.currency = input.currency;
    }
    if (input.defaultStake !== undefined) {
      const stake = Number(input.defaultStake);
      if (!Number.isFinite(stake) || stake <= 0 || stake > MAX_STAKE) return { ok: false, error: ERRORS.stake };
      patch.default_stake = Math.round(stake * 100) / 100;
    }
    if (input.notifyKickoff !== undefined) patch.notify_kickoff = Boolean(input.notifyKickoff);
    if (input.notifyResults !== undefined) patch.notify_results = Boolean(input.notifyResults);
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await createAdminClient().from('profiles').update(patch).eq('id', viewer.user.id);
    if (error) return { ok: false, error: ERRORS.generic };
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    console.error('[preferencias]', e);
    return { ok: false, error: ERRORS.generic };
  }
}
