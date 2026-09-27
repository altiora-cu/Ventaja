'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth/viewer';
import type { Profile } from '@/lib/db/types';
import { runPredictions, todayKey } from '@/lib/data/predict';
import { ingestFixtures } from '@/lib/data/ingest';
import { ingestOdds } from '@/lib/data/odds-ingest';

export type AdminAction = 'activate30' | 'activate90' | 'extend7' | 'suspend' | 'unsuspend';

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer.isAdmin) throw new Error('Solo admin');
  return viewer;
}

const DAY = 86_400_000;

/** Acciones por usuario. Usa la sesión del admin (RLS: admin edita todas las filas). */
export async function adminUpdateUser(userId: string, action: AdminAction): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createClient();
    const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>();
    if (!p) return { ok: false, error: 'Usuario no encontrado' };
    const now = Date.now();
    const paid = p.paid_until ? new Date(p.paid_until).getTime() : 0;
    const base = Math.max(now, paid);
    let patch: Partial<Profile> = {};
    switch (action) {
      case 'activate30':
        patch = { status: 'activa', paid_until: new Date(base + 30 * DAY).toISOString() };
        break;
      case 'activate90':
        patch = { status: 'activa', paid_until: new Date(base + 90 * DAY).toISOString() };
        break;
      case 'extend7': {
        // Extiende lo que esté vigente: pago si existe, si no el trial.
        if (paid > now) patch = { status: 'activa', paid_until: new Date(paid + 7 * DAY).toISOString() };
        else patch = { status: 'trial', trial_ends_at: new Date(Math.max(now, new Date(p.trial_ends_at).getTime()) + 7 * DAY).toISOString() };
        break;
      }
      case 'suspend':
        patch = { status: 'suspendida', paid_until: null };
        break;
      case 'unsuspend':
        patch = { status: paid > now ? 'activa' : new Date(p.trial_ends_at).getTime() > now ? 'trial' : 'vencida' };
        break;
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/admin');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Botón "Recalcular predicciones de hoy": dispara el cron manualmente. */
export async function adminRecalcToday(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    await requireAdmin();
    const r = await runPredictions(todayKey());
    revalidatePath('/');
    return { ok: true, count: r.predictions };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Botón "Actualizar partidos y cuotas": fixtures + odds + predicciones. */
export async function adminIngestNow(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    await requireAdmin();
    await ingestFixtures(7);
    await ingestOdds();
    const r = await runPredictions();
    revalidatePath('/');
    return { ok: true, count: r.predictions };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
