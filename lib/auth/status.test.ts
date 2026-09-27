import { describe, expect, it } from 'vitest';
import { isNewSession, persistedStatus, reminderKindFor, resolveStatus, TRIAL_DAYS } from './status';

const now = new Date('2026-09-27T12:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

const base = { role: 'user' as const, status: 'trial' as const, trial_ends_at: days(20), paid_until: null };

describe('resolveStatus', () => {
  it('admin siempre tiene acceso y nunca ve recordatorios', () => {
    const r = resolveStatus({ ...base, role: 'admin', trial_ends_at: days(-100), status: 'suspendida' }, now);
    expect(r.status).toBe('admin');
    expect(r.canAccess).toBe(true);
    expect(r.needsReminder).toBe(false);
  });

  it('pago vigente → activa aunque el trial haya vencido', () => {
    const r = resolveStatus({ ...base, trial_ends_at: days(-5), paid_until: days(30) }, now);
    expect(r.status).toBe('activa');
    expect(r.canAccess).toBe(true);
    expect(r.daysLeft).toBe(30);
  });

  it('suspendida sin pago vigente → sin acceso', () => {
    const r = resolveStatus({ ...base, status: 'suspendida' }, now);
    expect(r.status).toBe('suspendida');
    expect(r.canAccess).toBe(false);
  });

  it('trial vigente → trial con días restantes', () => {
    const r = resolveStatus(base, now);
    expect(r.status).toBe('trial');
    expect(r.daysLeft).toBe(20);
    expect(r.needsReminder).toBe(false);
  });

  it('registro nuevo → exactamente 31 días', () => {
    const r = resolveStatus({ ...base, trial_ends_at: days(TRIAL_DAYS) }, now);
    expect(r.daysLeft).toBe(31);
  });

  it('últimos 5 días → recordatorio', () => {
    expect(resolveStatus({ ...base, trial_ends_at: days(5) }, now).needsReminder).toBe(true);
    expect(resolveStatus({ ...base, trial_ends_at: days(6) }, now).needsReminder).toBe(false);
    expect(resolveStatus({ ...base, trial_ends_at: days(0.5) }, now).daysLeft).toBe(1);
  });

  it('trial vencido sin pago → vencida', () => {
    const r = resolveStatus({ ...base, trial_ends_at: days(-0.01) }, now);
    expect(r.status).toBe('vencida');
    expect(r.canAccess).toBe(false);
  });

  it('el campo status guardado no manda: trial vigente aunque diga vencida', () => {
    const r = resolveStatus({ ...base, status: 'vencida' }, now);
    expect(r.status).toBe('trial');
  });

  it('renovación: activa con ≤5 días → recordatorio de renovación', () => {
    const r = resolveStatus({ ...base, paid_until: days(3) }, now);
    expect(r.needsReminder).toBe(true);
    expect(r.isRenewal).toBe(true);
  });
});

describe('persistedStatus', () => {
  it('mapea admin a activa y respeta las fechas', () => {
    expect(persistedStatus({ ...base, role: 'admin' }, now)).toBe('activa');
    expect(persistedStatus({ ...base, trial_ends_at: days(-1) }, now)).toBe('vencida');
    expect(persistedStatus({ ...base, paid_until: days(10) }, now)).toBe('activa');
  });
});

describe('isNewSession', () => {
  it('nunca visto o >30 min → nueva sesión', () => {
    expect(isNewSession(null, now)).toBe(true);
    expect(isNewSession(new Date(now.getTime() - 31 * 60_000).toISOString(), now)).toBe(true);
    expect(isNewSession(new Date(now.getTime() - 10 * 60_000).toISOString(), now)).toBe(false);
  });
});

describe('reminderKindFor', () => {
  it('día 26/29/31 del trial', () => {
    expect(reminderKindFor(resolveStatus({ ...base, trial_ends_at: days(5) }, now))).toBe('trial_5');
    expect(reminderKindFor(resolveStatus({ ...base, trial_ends_at: days(2) }, now))).toBe('trial_2');
    expect(reminderKindFor(resolveStatus({ ...base, trial_ends_at: days(0.3) }, now))).toBe('trial_2');
    expect(reminderKindFor(resolveStatus({ ...base, trial_ends_at: days(10) }, now))).toBeNull();
    expect(reminderKindFor(resolveStatus({ ...base, paid_until: days(4) }, now))).toBe('renew_5');
  });
});
