import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';
import type { PushSubscriptionRow } from '@/lib/db/types';

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta a abrir al tocar el aviso. */
  url: string;
  /** Agrupa avisos del mismo tipo en el dispositivo. */
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  /** Suscripciones caducadas (404/410) que se borraron. */
  removed: number;
  failed: number;
}

const MAX_FAILURES = 5;
const GONE = new Set([404, 410]);

/** Claves VAPID: NEXT_PUBLIC_VAPID_PUBLIC_KEY (navegador), VAPID_PRIVATE_KEY y VAPID_SUBJECT (mailto: o https:). */
export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:hola@ventaja.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
  return true;
}

/** Envía un aviso a todos los dispositivos del usuario. Borra las suscripciones que el navegador ya dio de baja. */
export async function sendPushToUser(admin: SupabaseClient, userId: string, payload: PushPayload): Promise<PushSendResult> {
  const out: PushSendResult = { sent: 0, removed: 0, failed: 0 };
  if (!configure()) return out;
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userId).returns<PushSubscriptionRow[]>();
  if (!subs?.length) return out;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 6 * 3600, urgency: 'normal' });
        out.sent++;
        await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString(), failures: 0 }).eq('id', s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if ((status && GONE.has(status)) || s.failures + 1 >= MAX_FAILURES) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
          out.removed++;
        } else {
          await admin.from('push_subscriptions').update({ failures: s.failures + 1 }).eq('id', s.id);
          out.failed++;
        }
      }
    }),
  );
  return out;
}

/** Reserva la clave en push_log. Devuelve false si ya se había enviado (otra corrida se adelantó). */
export async function claimPushKey(admin: SupabaseClient, userId: string, key: string): Promise<boolean> {
  const { error } = await admin.from('push_log').insert({ user_id: userId, key });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}
