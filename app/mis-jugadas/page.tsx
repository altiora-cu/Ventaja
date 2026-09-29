import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ComboCard } from '@/components/jugadas/ComboCard';
import { RemovePlayButton } from '@/components/jugadas/RemovePlayButton';
import { ResultBadge } from '@/components/ui/ResultBadge';
import { Sello } from '@/components/ui/Sello';
import { StatTiles } from '@/components/ui/StatTiles';
import { getViewer } from '@/lib/auth/viewer';
import { getUserPlays, type UserPickFull } from '@/lib/data/jugadas';
import { isFinished } from '@/lib/data/statuses';
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

/** true mientras el partido no haya empezado: solo entonces se puede quitar la jugada. */
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
  const labels = { pendiente: t('statusPending'), acierto: t('statusAcierto'), fallo: t('statusFallo'), nulo: t('statusNulo'), jointProb: tp('jointProb'), totalOdds: tp('totalOdds') };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 max-w-lectura text-sm text-muted">{t('subtitle')}</p>
      </div>

      <StatTiles
        tiles={[
          { label: t('winRate'), value: pct(overall.hitRate), hint: t('winRateHint', { hits: overall.hits, decided: overall.decided }), accent: true },
          { label: t('units'), value: `${fmtUnits(overall.units)}u`, hint: t('unitsHint') },
          { label: t('pending'), value: String(overall.pending) },
          { label: t('total'), value: String(overall.total) },
        ]}
      />

      <section className="space-y-3" aria-labelledby="jugadas-sueltas">
        <h2 id="jugadas-sueltas" className="flex items-baseline justify-between text-sm font-medium text-muted">
          <span>{t('singles')}</span>
          <span className="num text-xs text-faint">{pct(data.singlesSummary.hitRate)}</span>
        </h2>
        {singles.length === 0 ? (
          <p className="card p-8 text-center text-muted">{t('emptySingles')}</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {singles.map((p) => (
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
                    <div className="self-end">
                      <Sello nivel={p.sello} animate={false} />
                    </div>
                  </dl>
                  {p.result ? (
                    <span className={`num text-lg font-semibold ${p.result === 'acierto' ? 'text-acierto' : p.result === 'fallo' ? 'text-fallo' : 'text-nulo'}`}>{fmtUnits(Number(p.units))}u</span>
                  ) : (
                    canRemove(p, now) && <RemovePlayButton kind="jugada" id={p.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="jugadas-combinadas">
        <h2 id="jugadas-combinadas" className="flex items-baseline justify-between text-sm font-medium text-muted">
          <span>{t('combos')}</span>
          <span className="num text-xs text-faint">{pct(data.combosSummary.hitRate)}</span>
        </h2>
        {combos.length === 0 ? (
          <p className="card p-8 text-center text-muted">{t('emptyCombos')}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {combos.map((c) => (
              <ComboCard
                key={c.id}
                title={c.kind === 'propia' ? t('kindPropia') : tp(`combo.${c.kind}`)}
                meta={`${fmtDate(c.created_at, locale, { day: 'numeric', month: 'short', year: 'numeric' }, timeZone)} · ${t('selections', { count: c.legs.length })}`}
                legs={c.legs.map((l) => ({ key: String(l.id), match: matchTitle(l), label: legLabel(l, locale), price: l.price === null ? null : Number(l.price), result: l.result }))}
                jointProb={Number(c.joint_prob)}
                totalPrice={c.total_price === null ? null : Number(c.total_price)}
                result={c.result}
                units={Number(c.units)}
                labels={labels}
                action={c.legs.length > 0 && c.legs.every((l) => canRemove(l, now)) ? <RemovePlayButton kind="combinada" id={c.id} /> : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
