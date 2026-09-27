import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Caché de llamadas externas en `ingest_log`: nunca repetir una llamada que ya está en caché
 * para la misma jornada/ventana. Devuelve true si toca volver a llamar.
 */
export async function shouldFetch(admin: SupabaseClient, key: string, ttlMs: number): Promise<boolean> {
  const { data } = await admin.from('ingest_log').select('fetched_at').eq('key', key).maybeSingle<{ fetched_at: string }>();
  if (!data) return true;
  return Date.now() - new Date(data.fetched_at).getTime() > ttlMs;
}

export async function markFetched(admin: SupabaseClient, key: string, note?: string, size?: number): Promise<void> {
  await admin.from('ingest_log').upsert({ key, fetched_at: new Date().toISOString(), note: note ?? null, payload_size: size ?? null });
}

export const TTL = {
  fixtures: 6 * 3600_000,
  results: 3600_000,
  stats: 20 * 3600_000,
  players: 20 * 3600_000,
  injuries: 6 * 3600_000,
  lineups: 30 * 60_000,
  odds: 2 * 3600_000,
  oddsMatchDay: 15 * 60_000,
  forever: 365 * 86_400_000,
};
