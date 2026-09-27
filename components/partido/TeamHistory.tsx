import { getTranslations } from 'next-intl/server';
import type { PickHistory, Team } from '@/lib/db/types';

function Dots({ picks }: { picks: PickHistory[] }) {
  if (!picks.length) return <span className="text-sm text-faint">—</span>;
  return (
    <span className="inline-flex gap-1">
      {picks.map((p) => (
        <span key={p.id} className={`h-3 w-3 rounded-full ${p.result === 'acierto' ? 'bg-acierto' : p.result === 'fallo' ? 'bg-fallo' : 'bg-nulo'}`} title={p.result} />
      ))}
    </span>
  );
}

export async function TeamHistory({ home, away, hist }: { home: Team; away: Team; hist: { home: PickHistory[]; away: PickHistory[] } }) {
  const t = await getTranslations('partido');
  const summary = (ps: PickHistory[]) => {
    const d = ps.filter((p) => p.result !== 'nulo');
    const h = d.filter((p) => p.result === 'acierto').length;
    return d.length ? `${h}/${d.length}` : '—';
  };
  return (
    <section className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('teamHistory')}</p>
      <div className="mt-3 space-y-3">
        {[
          { team: home, ps: hist.home },
          { team: away, ps: hist.away },
        ].map(({ team, ps }) => (
          <div key={team.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{team.name}</span>
            <span className="flex items-center gap-3">
              <Dots picks={ps} />
              <span className="num text-sm text-muted">{summary(ps)}</span>
            </span>
          </div>
        ))}
      </div>
      {!hist.home.length && !hist.away.length && <p className="mt-2 text-sm text-faint">{t('noHistory')}</p>}
    </section>
  );
}
