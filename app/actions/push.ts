'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getViewer } from '@/lib/auth/viewer';
import { pushConfigured, sendPushToUser } from '@/lib/push/send';

export interface PushActionResult {
  ok: boolean;
  error?: string;
}

interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const ERRORS = {
  auth: 'Inicia sesión para activar los avisos.',
  invalid: 'Suscripción inválida.',
  notConfigured: 'Los avisos push no están configurados en el servidor.',
  generic: 'No se pudo guardar. Inténtalo de nuevo.',
} as const;

const MAX_SUBSCRIPTIONS_PER_USER = 10;

function validSubscription(v: unknown): v is SubscriptionInput {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<SubscriptionInput>;
  return typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.endpoint.length < 2048 && !!s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
}

/** Guarda (o renueva) la suscripción push de este navegador. */
export async function savePushSubscription(subscription: unknown, userAgent?: string): Promise<PushActionResult> {
  try {
    if (!pushConfigured()) return { ok: false, error: ERRORS.notConfigured };
    if (!validSubscription(subscription)) return { ok: false, error: ERRORS.invalid };
    const viewer = await getViewer();
    if (!viewer.user) return { ok: false, error: ERRORS.auth };
    const admin = createAdminClient();
    const { count } = await admin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', viewer.user.id);
    if ((count ?? 0) >= MAX_SUBSCRIPTIONS_PER_USER) {
      // Se libera la más antigua para no acumular dispositivos muertos.
      const { data: oldest } = await admin.from('push_subscriptions').select('id').eq('user_id', viewer.user.id).order('created_at').limit(1).maybeSingle<{ id: number }>();
      if (oldest) await admin.from('push_subscriptions').delete().eq('id', oldest.id);
    }
    const row = { user_id: viewer.user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, user_agent: (userAgent ?? '').slice(0, 300) || null, failures: 0 };
    const { error } = await admin.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) return { ok: false, error: ERRORS.generic };
    return { ok: true };
  } catch (e) {
    console.error('[push:save]', e);
    return { ok: false, error: ERRORS.generic };
  }
}

/** Borra la suscripción de este navegador (el usuario desactivó los avisos). */
export async function removePushSubscription(endpoint: unknown): Promise<PushActionResult> {
  try {
    if (typeof endpoint !== 'string') return { ok: false, error: ERRORS.invalid };
    const viewer = await getViewer();
    if (!viewer.user) return { ok: false, error: ERRORS.auth };
    await createAdminClient().from('push_subscriptions').delete().eq('user_id', viewer.user.id).eq('endpoint', endpoint);
    return { ok: true };
  } catch (e) {
    console.error('[push:remove]', e);
    return { ok: false, error: ERRORS.generic };
  }
}

/** Envía un aviso de prueba a todos los dispositivos del usuario, para comprobar que llegan. */
export async function sendTestPush(): Promise<PushActionResult & { sent?: number }> {
  try {
    if (!pushConfigured()) return { ok: false, error: ERRORS.notConfigured };
    const viewer = await getViewer();
    if (!viewer.user) return { ok: false, error: ERRORS.auth };
    const es = viewer.profile?.locale !== 'en';
    const r = await sendPushToUser(createAdminClient(), viewer.user.id, {
      title: es ? 'Avisos activados' : 'Notifications on',
      body: es ? 'Te avisaremos antes del pitazo de tus jugadas y cuando se cierren.' : 'We will ping you before your plays kick off and when they settle.',
      url: '/mis-jugadas',
      tag: 'test',
    });
    return { ok: r.sent > 0, sent: r.sent, error: r.sent > 0 ? undefined : ERRORS.generic };
  } catch (e) {
    console.error('[push:test]', e);
    return { ok: false, error: ERRORS.generic };
  }
}
