import type { Locale } from '@/i18n/config';

export type ReminderKind = 'trial_5' | 'trial_2' | 'trial_0' | 'renew_5' | 'renew_2' | 'renew_0';

export interface ReminderVars {
  days: number;
  whatsappUrl: string;
  appUrl: string;
}

const COPY: Record<Locale, Record<ReminderKind, { subject: string; title: string; body: string }>> = {
  es: {
    trial_5: { subject: 'Te quedan 5 días de Ventaja', title: 'Te quedan {days} días de Ventaja.', body: 'Tu prueba gratis termina pronto. Activa tu acceso por WhatsApp y sigue leyendo cada partido antes del pitazo.' },
    trial_2: { subject: 'Tu prueba de Ventaja termina en 2 días', title: 'Quedan {days} días.', body: 'Después de este plazo la Jornada seguirá visible, pero las probabilidades y mercados quedarán bloqueados. Activa cuando quieras.' },
    trial_0: { subject: 'Hoy termina tu prueba de Ventaja', title: 'Tu prueba termina hoy.', body: 'Escríbenos por WhatsApp para activar tu acceso. El historial público sigue abierto para que veas cómo vamos.' },
    renew_5: { subject: 'Tu acceso a Ventaja vence en 5 días', title: 'Tu acceso vence en {days} días.', body: 'Renueva por WhatsApp y sigue sin interrupciones.' },
    renew_2: { subject: 'Tu acceso a Ventaja vence en 2 días', title: 'Quedan {days} días de acceso.', body: 'Renueva por WhatsApp para no perder la Lectura de los próximos partidos.' },
    renew_0: { subject: 'Hoy vence tu acceso a Ventaja', title: 'Tu acceso vence hoy.', body: 'Renueva por WhatsApp y mañana sigues leyendo cada partido.' },
  },
  en: {
    trial_5: { subject: '5 days left on your Ventaja trial', title: '{days} days of Ventaja left.', body: 'Your free trial ends soon. Activate your access via WhatsApp and keep reading every match before kickoff.' },
    trial_2: { subject: 'Your Ventaja trial ends in 2 days', title: '{days} days left.', body: 'After that, the matchday stays visible but probabilities and markets lock. Activate whenever you want.' },
    trial_0: { subject: 'Your Ventaja trial ends today', title: 'Your trial ends today.', body: 'Message us on WhatsApp to activate your access. The public track record stays open so you can see how we are doing.' },
    renew_5: { subject: 'Your Ventaja access expires in 5 days', title: 'Your access expires in {days} days.', body: 'Renew via WhatsApp and keep going without interruptions.' },
    renew_2: { subject: 'Your Ventaja access expires in 2 days', title: '{days} days of access left.', body: "Renew via WhatsApp so you don't lose the Read on the next matches." },
    renew_0: { subject: 'Your Ventaja access expires today', title: 'Your access expires today.', body: 'Renew via WhatsApp and keep reading every match tomorrow.' },
  },
};

const DISCLAIMER: Record<Locale, string> = {
  es: 'Ventaja es una herramienta de análisis estadístico. No garantiza resultados ni acepta apuestas. Solo para mayores de 21 años. Juega con responsabilidad. 1-800-GAMBLER.',
  en: 'Ventaja is a statistical analysis tool. It does not guarantee results or accept bets. 21+ only. Play responsibly. 1-800-GAMBLER.',
};

export function reminderEmail(kind: ReminderKind, locale: Locale, vars: ReminderVars): { subject: string; html: string; text: string } {
  const c = COPY[locale][kind];
  const title = c.title.replace('{days}', String(vars.days));
  const cta = locale === 'es' ? 'Activar por WhatsApp' : 'Activate via WhatsApp';
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${c.subject}</title></head>
<body style="margin:0;background:#0B0F14;color:#E8ECF1;font-family:'Inter Tight',Inter,system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0F14;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#111720;border:1px solid #1F2933;border-radius:12px;">
        <tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:600;letter-spacing:-0.03em;"><span style="color:#2EE59D;">V</span>entaja</td></tr>
        <tr><td style="padding:8px 28px 0;font-size:26px;font-weight:600;line-height:1.15;letter-spacing:-0.02em;">${title}</td></tr>
        <tr><td style="padding:12px 28px 0;font-size:16px;line-height:1.5;color:#8B96A5;">${c.body}</td></tr>
        <tr><td style="padding:24px 28px 8px;">
          <a href="${vars.whatsappUrl}" style="display:inline-block;background:#2EE59D;color:#06110C;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px;">${cta}</a>
        </td></tr>
        <tr><td style="padding:8px 28px 24px;font-size:13px;color:#55606E;">
          <a href="${vars.appUrl}" style="color:#8B96A5;">${vars.appUrl.replace(/^https?:\/\//, '')}</a>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #1F2933;font-size:12px;line-height:1.5;color:#55606E;">${DISCLAIMER[locale]}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `${title}\n\n${c.body}\n\n${cta}: ${vars.whatsappUrl}\n\n${DISCLAIMER[locale]}`;
  return { subject: c.subject, html, text };
}
