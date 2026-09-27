import 'server-only';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@/lib/db/types';
import { persistedStatus, reminderKindFor, resolveStatus } from '@/lib/auth/status';
import { isLocale } from '@/i18n/config';
import { appUrl, whatsappLink } from '@/lib/utils';
import { reminderEmail } from '@/emails/recordatorio';

export interface AccountsReport {
  profiles: number;
  statusUpdated: number;
  emailsSent: number;
  emailsSkipped: number;
  errors: string[];
}

/**
 * Cron diario 03:00 ET: actualiza `status` según fechas y envía recordatorios (día 26, 29 y 31).
 * Los recordatorios se registran en reminder_emails para no duplicarlos por ciclo de vencimiento.
 */
export async function runAccounts(now = new Date()): Promise<AccountsReport> {
  const admin = createAdminClient();
  const report: AccountsReport = { profiles: 0, statusUpdated: 0, emailsSent: 0, emailsSkipped: 0, errors: [] };
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const from = process.env.RESEND_FROM ?? 'Ventaja <hola@ventaja.app>';

  const { data: profiles, error } = await admin.from('profiles').select('*').returns<Profile[]>();
  if (error) throw error;
  report.profiles = profiles?.length ?? 0;

  for (const p of profiles ?? []) {
    try {
      const next = persistedStatus(p, now);
      if (next !== p.status) {
        await admin.from('profiles').update({ status: next }).eq('id', p.id);
        report.statusUpdated++;
      }
      if (p.role === 'admin') continue;

      const access = resolveStatus(p, now);
      const kind = reminderKindFor(access);
      if (!kind || !access.expiresAt) continue;

      const cycleKey = access.expiresAt.toISOString().slice(0, 10);
      const { data: already } = await admin.from('reminder_emails').select('id').eq('user_id', p.id).eq('kind', kind).eq('cycle_key', cycleKey).maybeSingle();
      if (already) {
        report.emailsSkipped++;
        continue;
      }
      if (!resend) {
        report.emailsSkipped++;
        continue;
      }
      const locale = isLocale(p.locale) ? p.locale : 'es';
      const mail = reminderEmail(kind, locale, { days: Math.max(0, access.daysLeft ?? 0), whatsappUrl: whatsappLink(p.email), appUrl: appUrl('/cuenta') });
      const { error: sendErr } = await resend.emails.send({ from, to: p.email, subject: mail.subject, html: mail.html, text: mail.text });
      if (sendErr) throw new Error(sendErr.message);
      await admin.from('reminder_emails').insert({ user_id: p.id, kind, cycle_key: cycleKey });
      report.emailsSent++;
    } catch (e) {
      report.errors.push(`${p.email}: ${(e as Error).message}`);
    }
  }
  return report;
}
