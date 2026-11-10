import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Currency, PickResult, Profile } from '@/lib/db/types';
import { fmtMoney, playMoney } from '@/lib/engine/money';
import { selectionLabel } from '@/lib/labels';
import { isLocale, type Locale } from '@/i18n/config';
import { fmtTime } from '@/lib/utils';
import { DEFAULT_TZ } from '@/lib/tz';
import { claimPushKey, pushConfigured, sendPushToUser, type PushPayload } from './send';

export interface PushReport {
  configured: boolean;
  kickoffUsers: number;
  resultUsers: number;
  sent: number;
  removed: number;
  errors: string[];
}

const DEFAULT_KICKOFF_HOURS = 24;
const RESULTS_LOOKBACK_DAYS = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MAX_LINES = 4;

type PlayRow = {
  id: number;
  user_id: string;
  combo_id: number | null;
  market: string;
  selection: string;
  line: number | null;
  player_name: string | null;
  price: number | null;
  stake: number | null;
  units: number;
  result: PickResult | null;
  settled_at: string | null;
  fixture: { id: number; kickoff: string; status: string; home: { name: string }; away: { name: string } } | null;
};

type ComboRow = { id: number; user_id: string; result: PickResult | null; units: number; stake: number | null; settled_at: string | null; total_price: number | null };

type ProfileLite = Pick<Profile, 'id' | 'locale' | 'currency' | 'notify_kickoff' | 'notify_results'>;

const T = {
  es: {
    kickoffTitle: (n: number) => (n === 1 ? 'Tu jugada arranca pronto' : `Tus ${n} jugadas arrancan pronto`),
    more: (n: number) => `… y ${n} más`,
    resultsTitle: (hits: number, misses: number) => (hits && !misses ? `¡${hits === 1 ? 'Jugada ganada' : `${hits} jugadas ganadas`}!` : `Resultados: ${hits} ganadas · ${misses} perdidas`),
    won: 'Ganada',
    lost: 'Perdida',
    voided: 'Nula',
    combo: 'Combinada',
    balance: (s: string) => `Balance: ${s}`,
  },
  en: {
    kickoffTitle: (n: number) => (n === 1 ? 'Your play starts soon' : `Your ${n} plays start soon`),
    more: (n: number) => `… and ${n} more`,
    resultsTitle: (hits: number, misses: number) => (hits && !misses ? `${hits === 1 ? 'Play won' : `${hits} plays won`}!` : `Results: ${hits} won · ${misses} lost`),
    won: 'Won',
    lost: 'Lost',
    voided: 'Void',
    combo: 'Parlay',
    balance: (s: string) => `Balance: ${s}`,
  },
} as const;

function localeOf(p: ProfileLite): Locale {
  return isLocale(p.locale) ? p.locale : 'es';
}

function legLabel(p: PlayRow, locale: Locale): string {
  if (!p.fixture) return p.market;
  return selectionLabel(p.market, p.selection, p.line === null ? null : Number(p.line), { home: p.fixture.home.name, away: p.fixture.away.name, player: p.player_name }, locale);
}

/**
 * Avisos push: (1) jugadas cuyo partido empieza en las próximas horas; (2) jugadas y combinadas cerradas desde el último aviso.
 * Un aviso por usuario y tipo por corrida; cada jugada se avisa una sola vez (push_log).
 * Con el cron diario (05:00 ET) la ventana de pitazo es de 24 h: "hoy juegan tus jugadas". En plan Pro, cada 2 h con PUSH_KICKOFF_HOURS=3.
 */
export async function runPushNotifications(now = new Date()): Promise<PushReport> {
  const report: PushReport = { configured: pushConfigured(), kickoffUsers: 0, resultUsers: 0, sent: 0, removed: 0, errors: [] };
  if (!report.configured) return report;
  const admin = createAdminClient();
  const kickoffHours = Number(process.env.PUSH_KICKOFF_HOURS) || DEFAULT_KICKOFF_HOURS;
  const select = 'id,user_id,combo_id,market,selection,line,player_name,price,stake,units,result,settled_at,fixture:fixtures(id,kickoff,status,home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name))';

  const [{ data: upcoming }, { data: settled }, { data: combos }, { data: subs }] = await Promise.all([
    admin.from('user_picks').select(select).is('result', null).limit(5000).returns<PlayRow[]>(),
    admin.from('user_picks').select(select).is('combo_id', null).not('result', 'is', null).gte('settled_at', new Date(now.getTime() - RESULTS_LOOKBACK_DAYS * DAY_MS).toISOString()).limit(5000).returns<PlayRow[]>(),
    admin.from('user_combos').select('id,user_id,result,units,stake,settled_at,total_price').not('result', 'is', null).gte('settled_at', new Date(now.getTime() - RESULTS_LOOKBACK_DAYS * DAY_MS).toISOString()).limit(2000).returns<ComboRow[]>(),
    admin.from('push_subscriptions').select('user_id').returns<Array<{ user_id: string }>>(),
  ]);
  const subscribed = new Set((subs ?? []).map((s) => s.user_id));
  if (!subscribed.size) return report;

  const userIds = [...subscribed];
  const { data: profiles } = await admin.from('profiles').select('id,locale,currency,notify_kickoff,notify_results').in('id', userIds).returns<ProfileLite[]>();
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const send = async (userId: string, payload: PushPayload) => {
    const r = await sendPushToUser(admin, userId, payload);
    report.sent += r.sent;
    report.removed += r.removed;
  };

  // 1. Pitazo próximo
  const windowEnd = now.getTime() + kickoffHours * HOUR_MS;
  const byUserKick = new Map<string, PlayRow[]>();
  for (const p of upcoming ?? []) {
    if (!p.fixture || !subscribed.has(p.user_id)) continue;
    const k = new Date(p.fixture.kickoff).getTime();
    if (k <= now.getTime() || k > windowEnd) continue;
    byUserKick.set(p.user_id, [...(byUserKick.get(p.user_id) ?? []), p]);
  }
  for (const [userId, plays] of byUserKick) {
    const profile = profileMap.get(userId);
    if (!profile || !profile.notify_kickoff) continue;
    try {
      const fresh: PlayRow[] = [];
      for (const p of plays) if (await claimPushKey(admin, userId, `kickoff:${p.id}`)) fresh.push(p);
      if (!fresh.length) continue;
      const locale = localeOf(profile);
      const t = T[locale];
      // Una línea por partido (una combinada puede tener varias selecciones del mismo usuario en partidos distintos).
      const byFixture = new Map<number, PlayRow[]>();
      for (const p of fresh) byFixture.set(p.fixture!.id, [...(byFixture.get(p.fixture!.id) ?? []), p]);
      const lines = [...byFixture.values()]
        .sort((a, b) => new Date(a[0].fixture!.kickoff).getTime() - new Date(b[0].fixture!.kickoff).getTime())
        .map((group) => `${fmtTime(group[0].fixture!.kickoff, locale, DEFAULT_TZ)} · ${group.map((p) => legLabel(p, locale)).join(', ')}`);
      const body = [...lines.slice(0, MAX_LINES), ...(lines.length > MAX_LINES ? [t.more(lines.length - MAX_LINES)] : [])].join('\n');
      await send(userId, { title: t.kickoffTitle(fresh.length), body, url: '/mis-jugadas', tag: 'kickoff' });
      report.kickoffUsers++;
    } catch (e) {
      report.errors.push(`kickoff ${userId}: ${(e as Error).message}`);
    }
  }

  // 2. Resultados
  const byUserRes = new Map<string, { picks: PlayRow[]; combos: ComboRow[] }>();
  for (const p of settled ?? []) {
    if (!subscribed.has(p.user_id)) continue;
    const e = byUserRes.get(p.user_id) ?? { picks: [], combos: [] };
    e.picks.push(p);
    byUserRes.set(p.user_id, e);
  }
  for (const c of combos ?? []) {
    if (!subscribed.has(c.user_id)) continue;
    const e = byUserRes.get(c.user_id) ?? { picks: [], combos: [] };
    e.combos.push(c);
    byUserRes.set(c.user_id, e);
  }
  for (const [userId, { picks, combos: userCombos }] of byUserRes) {
    const profile = profileMap.get(userId);
    if (!profile || !profile.notify_results) continue;
    try {
      const freshPicks: PlayRow[] = [];
      for (const p of picks) if (await claimPushKey(admin, userId, `result:pick:${p.id}`)) freshPicks.push(p);
      const freshCombos: ComboRow[] = [];
      for (const c of userCombos) if (await claimPushKey(admin, userId, `result:combo:${c.id}`)) freshCombos.push(c);
      if (!freshPicks.length && !freshCombos.length) continue;
      const locale = localeOf(profile);
      const t = T[locale];
      const currency: Currency = profile.currency ?? 'USD';
      const all = [...freshPicks.map((p) => ({ result: p.result, units: Number(p.units), stake: p.stake })), ...freshCombos.map((c) => ({ result: c.result, units: Number(c.units), stake: c.stake }))];
      const hits = all.filter((x) => x.result === 'acierto').length;
      const misses = all.filter((x) => x.result === 'fallo').length;
      const balance = all.reduce((acc, x) => acc + playMoney(x.units, x.stake === null ? null : Number(x.stake)), 0);
      const resultWord = (r: PickResult | null) => (r === 'acierto' ? t.won : r === 'fallo' ? t.lost : t.voided);
      const lines = [
        ...freshPicks.map((p) => `${resultWord(p.result)} · ${p.fixture ? `${p.fixture.home.name} vs ${p.fixture.away.name}: ` : ''}${legLabel(p, locale)}`),
        ...freshCombos.map((c) => `${resultWord(c.result)} · ${t.combo}${c.total_price ? ` @${Number(c.total_price).toFixed(2)}` : ''}`),
      ];
      const body = [...lines.slice(0, MAX_LINES), ...(lines.length > MAX_LINES ? [t.more(lines.length - MAX_LINES)] : []), t.balance(fmtMoney(balance, currency, locale, true))].join('\n');
      await send(userId, { title: t.resultsTitle(hits, misses), body, url: '/mis-jugadas', tag: 'results' });
      report.resultUsers++;
    } catch (e) {
      report.errors.push(`results ${userId}: ${(e as Error).message}`);
    }
  }

  return report;
}
