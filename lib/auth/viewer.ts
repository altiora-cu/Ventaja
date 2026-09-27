import 'server-only';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/admin';
import type { Profile } from '@/lib/db/types';
import { isNewSession, resolveStatus, type AccessInfo } from './status';

export interface Viewer {
  user: User | null;
  profile: Profile | null;
  access: AccessInfo;
  isAdmin: boolean;
  /** true solo en una "sesión nueva" (≥30 min sin actividad) y si aplica recordatorio. */
  showReminder: boolean;
}

const ANON_ACCESS: AccessInfo = {
  status: 'vencida',
  canAccess: false,
  daysLeft: null,
  expiresAt: null,
  needsReminder: false,
  isRenewal: false,
};

/**
 * Viewer actual (memoizado por request). Fuente de verdad: fechas del perfil.
 * También registra last_seen_at, que es lo que decide si el recordatorio es "por sesión".
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (!hasSupabaseEnv()) {
    return { user: null, profile: null, access: ANON_ACCESS, isAdmin: false, showReminder: false };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, profile: null, access: ANON_ACCESS, isAdmin: false, showReminder: false };
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  if (!profile) {
    return { user, profile: null, access: ANON_ACCESS, isAdmin: false, showReminder: false };
  }

  const now = new Date();
  const access = resolveStatus(profile, now);
  const newSession = isNewSession(profile.last_seen_at, now);
  const showReminder = access.needsReminder && newSession;

  // Registrar actividad (mejor esfuerzo; RLS permite actualizar la propia fila).
  if (newSession || !profile.last_seen_at) {
    void supabase.from('profiles').update({ last_seen_at: now.toISOString() }).eq('id', user.id);
  }

  return { user, profile, access, isAdmin: access.status === 'admin', showReminder };
});
