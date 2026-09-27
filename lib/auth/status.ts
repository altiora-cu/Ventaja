import type { AccountStatus, Profile } from '@/lib/db/types';

export type ResolvedStatus = AccountStatus | 'admin';

export interface AccessInfo {
  status: ResolvedStatus;
  /** Puede ver probabilidades, mercados y picks. */
  canAccess: boolean;
  /** Días enteros restantes (ceil) de trial o de pago. 0 = vence hoy. null si no aplica. */
  daysLeft: number | null;
  /** Vencimiento efectivo (trial_ends_at o paid_until). */
  expiresAt: Date | null;
  /** Debe ver recordatorio de pago (≤ 5 días y no admin). */
  needsReminder: boolean;
  /** true si el recordatorio es de renovación (cuenta activa) y no de fin de prueba. */
  isRenewal: boolean;
}

export const REMINDER_WINDOW_DAYS = 5;
export const TRIAL_DAYS = 31;

const DAY_MS = 86_400_000;

export function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Regla de estado (fuente de verdad: fechas, no el campo `status`).
 * 1. admin → acceso ilimitado, sin recordatorios ni paywall.
 * 2. paid_until > now → activa.
 * 3. status = suspendida → paywall con texto de suspensión.
 * 4. trial_ends_at > now y sin pago → trial.
 * 5. si no → vencida.
 */
export function resolveStatus(
  profile: Pick<Profile, 'role' | 'status' | 'trial_ends_at' | 'paid_until'>,
  now: Date = new Date(),
): AccessInfo {
  if (profile.role === 'admin') {
    return { status: 'admin', canAccess: true, daysLeft: null, expiresAt: null, needsReminder: false, isRenewal: false };
  }

  const paidUntil = profile.paid_until ? new Date(profile.paid_until) : null;
  if (paidUntil && paidUntil.getTime() > now.getTime()) {
    const daysLeft = daysUntil(paidUntil, now);
    return {
      status: 'activa',
      canAccess: true,
      daysLeft,
      expiresAt: paidUntil,
      needsReminder: daysLeft <= REMINDER_WINDOW_DAYS,
      isRenewal: true,
    };
  }

  if (profile.status === 'suspendida') {
    return { status: 'suspendida', canAccess: false, daysLeft: null, expiresAt: null, needsReminder: false, isRenewal: false };
  }

  const trialEnds = new Date(profile.trial_ends_at);
  if (trialEnds.getTime() > now.getTime()) {
    const daysLeft = daysUntil(trialEnds, now);
    return {
      status: 'trial',
      canAccess: true,
      daysLeft,
      expiresAt: trialEnds,
      needsReminder: daysLeft <= REMINDER_WINDOW_DAYS,
      isRenewal: false,
    };
  }

  return {
    status: 'vencida',
    canAccess: false,
    daysLeft: 0,
    expiresAt: paidUntil ?? trialEnds,
    needsReminder: false,
    isRenewal: Boolean(paidUntil),
  };
}

/** Valor que debe persistirse en `profiles.status` según las fechas (lo usa el cron diario). */
export function persistedStatus(
  profile: Pick<Profile, 'role' | 'status' | 'trial_ends_at' | 'paid_until'>,
  now: Date = new Date(),
): AccountStatus {
  const r = resolveStatus(profile, now).status;
  if (r === 'admin') return 'activa';
  return r;
}

/**
 * Sesión "nueva": last_seen_at hace más de 30 minutos (o nunca).
 * Se usa para decidir si mostrar el modal de recordatorio.
 */
export function isNewSession(lastSeenAt: string | null, now: Date = new Date(), windowMinutes = 30): boolean {
  if (!lastSeenAt) return true;
  const last = new Date(lastSeenAt).getTime();
  return now.getTime() - last > windowMinutes * 60_000;
}

/** Qué email de recordatorio corresponde hoy: 5, 2 o 0 días antes (día 26, 29 y 31 del trial). */
export function reminderKindFor(access: AccessInfo): 'trial_5' | 'trial_2' | 'trial_0' | 'renew_5' | 'renew_2' | 'renew_0' | null {
  if (access.status !== 'trial' && access.status !== 'activa') return null;
  if (access.daysLeft === null) return null;
  const prefix = access.isRenewal ? 'renew' : 'trial';
  if (access.daysLeft <= 0) return `${prefix}_0`;
  if (access.daysLeft <= 2) return `${prefix}_2`;
  if (access.daysLeft <= 5) return `${prefix}_5`;
  return null;
}
