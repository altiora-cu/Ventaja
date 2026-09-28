import { getTranslations } from 'next-intl/server';
import { ComboCard } from '@/components/jugadas/ComboCard';
import { StatTiles } from '@/components/ui/StatTiles';
import type { SystemCombosData } from '@/lib/data/jugadas';
import { selectionLabel } from '@/lib/labels';
import { fmtDate, fmtUnits, pct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

/** Combinadas registradas por el sistema. Las que siguen en juego solo llegan con acceso activo (RLS). */
export async function SystemCombos({ data, canSee, locale }: { data: SystemCombosData; canSee: boolean; locale: Locale }) {
  const [t, tp, tj] = await Promise.all([getTranslations('historial'), getTranslations('picks'), getTranslations('jugadas')]);
  const { combos, summary } = data;
  const lockedNote = canSee ? null : <p className="rounded-md border border-border bg-elevated px-4 py-3 text-sm text-muted">{t('lockedCombo')}</p>;
  if (combos.length === 0) {
    return (
      <div className="space-y-3">
        <p className="card p-8 text-center text-muted">{t('combosEmpty')}</p>
        {lockedNote}
      </div>
    );
  }

  const labels = { pendiente: tj('statusPending'), acierto: tj('statusAcierto'), fallo: tj('statusFallo'), nulo: tj('statusNulo'), jointProb: tp('jointProb'), totalOdds: tp('totalOdds') };

  return (
    <section className="space-y-4">
      <p className="max-w-lectura text-sm text-muted">{t('combosHint')}</p>
      {lockedNote}
      <StatTiles
        tiles={[
          { label: t('combosHitRate'), value: pct(summary.hitRate), accent: true },
          { label: tj('units'), value: `${fmtUnits(summary.units)}u`, hint: tj('unitsHint') },
          { label: t('combosClosed'), value: String(summary.decided + summary.voids) },
          { label: t('combosPending'), value: String(summary.pending) },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {combos.map((c) => (
          <ComboCard
            key={c.id}
            title={tp(`combo.${c.kind}`)}
            meta={`${fmtDate(`${c.date_key}T12:00:00Z`, locale, { day: 'numeric', month: 'short', year: 'numeric' }, 'UTC')} · ${tp('selections', { count: c.selections.length })}`}
            legs={c.selections.map((s) => ({
              key: `${s.fixture_id}-${s.market}-${s.selection}-${s.line}-${s.player_id}`,
              match: `${s.home} vs ${s.away} · ${s.league}`,
              label: selectionLabel(s.market, s.selection, s.line, { home: s.home, away: s.away, player: s.player_name }, locale),
              price: Number(s.price),
              result: s.result,
            }))}
            jointProb={Number(c.joint_prob)}
            totalPrice={Number(c.total_price)}
            result={c.result}
            units={Number(c.units)}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}
