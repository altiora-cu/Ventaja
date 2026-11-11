import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ComboCard } from '@/components/jugadas/ComboCard';
import { RemovePlayButton } from '@/components/jugadas/RemovePlayButton';
import { StakeInput } from '@/components/jugadas/StakeInput';
import { ResultBadge } from '@/components/ui/ResultBadge';
import { Sello } from '@/components/ui/Sello';
import { StatTiles } from '@/components/ui/StatTiles';
import { getViewer } from '@/lib/auth/viewer';
import { getUserPlays, type UserPickFull } from '@/lib/data/jugadas';
import { isFinished } from '@/lib/data/statuses';
import { DEFAULT_STAKE, fmtMoney, monthlyRecord, playMoney, streaks, summarizeMoney } from '@/lib/engine/money';
import { selectionLabel } from '@/lib/labels';
import { getTimeZone } from '@/lib/tz';
import { fmtDate, fmtTime, fmtUnits, odds, pct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

const OPEN_STATUSES = ['NS', 'TBD'];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jugadas');
  return { title: t('title'), description: t('subtitle') };
}

/** true mientras el partido no haya empezado: solo entonces se puede quitar la jugada o cambiar el stake. */
function canRemove(p: UserPickFull, now: number): boolean {
  return p.result === null && p.fixture !== null && OPEN_STATUSES.includes(p.fixture.status) && new Date(p.fixture.kickoff).getTime() > now;
}

function legLabel(p: UserPickFull, locale: Locale): string {
  if (!p.fixture) return p.market;
  return selectionLabel(p.market, p.selection, p.line === null ? null : Number(p.line), { home: p.fixture.home.name, away: p.fixture.away.name, player: p.player_name }, locale);
}

function matchTitle(p: UserPickFull): string {
  const f = p.fixture;
  if (!f) return '—';
  return isFinished(f.status) ? `${f.home.name} ${f.home_goals}–${f.away_goals} ${f.away.name}` : `${f.home.name} vs ${f.away.name}`;
}

export default async function MisJugadasPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect('/login?next=/mis-jugadas');
  const [t, tc, tp, locale, data] = await Promise.all([getTranslations('jugadas'), getTranslations('common'), getTranslations('picks'), getLocale() as Promise<Locale>, getUserPlays(viewer.user.id)]);
  const timeZone = getTimeZone();
  const now = Date.now();
  const { overall, singles, combos } = data;
  const currency = viewer.profile?.currency ?? 'USD';
  const defaultStake = Number(viewer.profile?.default_stake) || DEFAULT_STAKE;
  const labels = { pendiente: t('statusPending'), acierto: t('statusAcierto'), fallo: t('statusFallo'), nulo: t('statusNulo'), jointProb: tp('jointProb'), totalOdds: tp('totalOdds') };

  // En juego: sin resultado y con partido por delante, de la más próxima a la más lejana. El resto, cerradas (o empezadas).
  const open = singles.filter((p) => canRemove(p, now)).sort((a, b) => new Date(a.fixture!.kickoff).getTime() - new Date(b.fixture!.kickoff).getTime());
  const closed = singles.filter((p) => !canRemove(p, now));

  // Dinero y registro: jugadas sueltas y combinadas juntas.
  const outcomes = [...singles, ...combos].map((p) => ({ result: p.result, units: Number(p.units), stake: p.stake === null ? null : Number(p.stake), settled_at: p.settled_at }));
  const money = summarizeMoney(outcomes);
  const st = streaks(outcomes);
  const record = monthlyRecord(outcomes, timeZone);
  // "octubre de 2026" → "Octubre de 2026": solo la primera letra, no cada palabra.
  const fmtMonth = (m: string) => {
    const s = fmtDate(`${m}-15T12:00:00Z`, locale, { month: 'long', year: 'numeric' }, 'UTC');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const moneyOf = (p: { result: string | null; units: number; stake: number | null }) => (p.stake === null ? null : fmtMoney(playMoney(Number(p.units), Number(p.stake)), currency, locale, true));
  // Valor numérico con signo en la tipografía de números; la explicación va en la nota pequeña.
  const streakValue = st.current > 0 ? `+${st.current}` : st.current < 0 ? `−${-st.current}` : '0';
  const streakHint = `${st.current > 0 ? t('streakWin', { count: st.current }) : st.current < 0 ? t('streakLoss', { count: -st.current }) : t('streakNone')} · ${t('streakHint', { best: st.bestWin, worst: st.worstLoss })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 max-w-lectura text-sm text-muted">{t('subtitle')}</p>
      </div>

      <StatTiles
        tiles={[
          { label: t('balance'), value: fmtMoney(money.balance, currency, locale, true), hint: `${fmtUnits(overall.units)}u · ${t('staked', { amount: fmtMoney(money.staked, currency, locale) })}`, accent: money.balance > 0 },
          { label: t('winRate'), value: overall.decided > 0 ? pct(overall.hitRate) : '—', hint: overall.decided > 0 ? t('winRateHint', { hits: overall.hits, decided: overall.decided }) : t('noDecided') },
          { label: t('pending'), value: String(overall.pending), hint: t('pendingHint', { count: open.length, combos: combos.filter((c) => c.result === null).length }) },
          { label: t('total'), value: String(overall.total) },
        ]}
      />

      <section className="space-y-3" aria-labelledby="registro">
        <h2 id="registro" className="text-sm font-medium text-muted">
          {t('record')}
        </h2>
        <StatTiles
          tiles={[
            { label: t('won'), value: String(overall.hits), accent: overall.hits > 0 },
            { label: t('lost'), value: String(overall.misses) },
            { label: t('void'), value: String(overall.voids) },
            { label: t('streak'), value: streakValue, hint: streakHint, accent: st.current > 0 },
          ]}
        />
        {record.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.04em] text-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('month')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('recordCol')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('unitsCol')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {record.map((r) => (
                  <tr key={r.month}>
                    <td className="px-4 py-2">{fmtMonth(r.month)}</td>
                    <td className="num px-2 py-2 text-right">
                      {r.hits}-{r.misses}
                      {r.voids ? <span className="text-faint">-{r.voids}</span> : null}
                    </td>
                    <td className="num px-2 py-2 text-right text-muted">{fmtUnits(r.units)}u</td>
                    <td className={`num px-4 py-2 text-right ${r.balance > 0 ? 'text-acierto' : r.balance < 0 ? 'text-nulo' : ''}`}>{fmtMoney(r.balance, currency, locale, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {money.withoutStake > 0 && <p className="text-xs text-faint">{t('withoutStake', { count: money.withoutStake })}</p>}
      </section>

      {(
        [
          { id: 'jugadas-en-juego', title: t('inPlay'), list: open, empty: t('emptyInPlay'), rate: null },
          { id: 'jugadas-cerradas', title: t('closed'), list: closed, empty: t('emptySingles'), rate: data.singlesSummary.decided > 0 ? pct(data.singlesSummary.hitRate) : null },
        ] as const
      ).map(({ id, title, list, empty, rate }) => (
        <section key={id} className="space-y-3" aria-labelledby={id}>
          <h2 id={id} className="flex items-baseline justify-between text-sm font-medium text-muted">
            <span>
              {title} <span className="num text-xs text-faint">({list.length})</span>
            </span>
            {rate && <span className="num text-xs text-faint">{rate}</span>}
          </h2>
          {list.length === 0 ? (
            <p className="card p-6 text-center text-sm text-muted">{empty}</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {list.map((p) => {
                const removable = canRemove(p, now);
                const stakeValue = p.stake === null ? null : Number(p.stake);
                const pnl = p.result ? moneyOf(p) : null;
                return (
                  <li key={p.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {p.fixture ? (
                          <Link href={`/partido/${p.fixture.id}`} className="text-xs text-muted hover:text-text">
                            {matchTitle(p)} · {p.fixture.league.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                        <p className="mt-1 font-medium leading-snug">{legLabel(p, locale)}</p>
                        {removable && p.sello === 'baja' && <p className="mt-1 text-xs text-[var(--warning)]">{t('notRecommended')}</p>}
                      </div>
                      <ResultBadge result={p.result} labels={labels} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                        {p.fixture && (
                          <div>
                            <dt className="text-xs text-faint">{tc('date')}</dt>
                            <dd className="num">
                              {fmtDate(p.fixture.kickoff, locale, { day: 'numeric', month: 'short' }, timeZone)} · {fmtTime(p.fixture.kickoff, locale, timeZone)}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs text-faint">{tc('probability')}</dt>
                          <dd className="num">{pct(Number(p.prob))}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-faint">{tc('odds')}</dt>
                          <dd className="num">{odds(p.price === null ? null : Number(p.price))}</dd>
                        </div>
                        {!removable && stakeValue !== null && (
                          <div>
                            <dt className="text-xs text-faint">{t('stakeLabel')}</dt>
                            <dd className="num">{fmtMoney(stakeValue, currency, locale)}</dd>
                          </div>
                        )}
                        <div className="self-end">
                          <Sello nivel={p.sello} animate={false} />
                        </div>
                      </dl>
                      {p.result ? (
                        <span className="text-right">
                          <span className={`num block text-lg font-semibold ${p.result === 'acierto' ? 'text-acierto' : p.result === 'fallo' ? 'text-fallo' : 'text-nulo'}`}>{pnl ?? `${fmtUnits(Number(p.units))}u`}</span>
                          {pnl && <span className="num block text-xs text-faint">{fmtUnits(Number(p.units))}u</span>}
                        </span>
                      ) : (
                        removable && (
                          <div className="flex items-end gap-3">
                            <StakeInput kind="jugada" id={p.id} value={stakeValue ?? defaultStake} currency={currency} />
                            <RemovePlayButton kind="jugada" id={p.id} />
                          </div>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <section className="space-y-3" aria-labelledby="jugadas-combinadas">
        <h2 id="jugadas-combinadas" className="flex items-baseline justify-between text-sm font-medium text-muted">
          <span>
            {t('combos')} <span className="num text-xs text-faint">({combos.length})</span>
          </span>
          {data.combosSummary.decided > 0 && <span className="num text-xs text-faint">{pct(data.combosSummary.hitRate)}</span>}
        </h2>
        {combos.length === 0 ? (
          <p className="card p-8 text-center text-muted">{t('emptyCombos')}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {combos.map((c) => {
              const openCombo = c.result === null && c.legs.length > 0 && c.legs.every((l) => canRemove(l, now));
              const stakeValue = c.stake === null ? null : Number(c.stake);
              return (
                <ComboCard
                  key={c.id}
                  title={c.kind === 'propia' ? t('kindPropia') : tp(`combo.${c.kind}`)}
                  meta={`${fmtDate(c.created_at, locale, { day: 'numeric', month: 'short', year: 'numeric' }, timeZone)} · ${t('selections', { count: c.legs.length })}${stakeValue !== null && !openCombo ? ` · ${t('stakeLabel')} ${fmtMoney(stakeValue, currency, locale)}` : ''}`}
                  legs={c.legs.map((l) => ({ key: String(l.id), match: matchTitle(l), label: legLabel(l, locale), price: l.price === null ? null : Number(l.price), result: l.result }))}
                  jointProb={Number(c.joint_prob)}
                  totalPrice={c.total_price === null ? null : Number(c.total_price)}
                  result={c.result}
                  units={Number(c.units)}
                  money={c.result ? moneyOf({ result: c.result, units: Number(c.units), stake: stakeValue }) : null}
                  labels={labels}
                  action={openCombo ? <RemovePlayButton kind="combinada" id={c.id} /> : undefined}
                  extra={openCombo ? <StakeInput kind="combinada" id={c.id} value={stakeValue ?? defaultStake} currency={currency} /> : undefined}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
