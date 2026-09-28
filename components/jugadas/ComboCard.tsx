import type { ReactNode } from 'react';
import { ResultBadge, type ResultLabels } from '@/components/ui/ResultBadge';
import type { PickResult } from '@/lib/db/types';
import { fmtUnits, odds, pct } from '@/lib/utils';

export interface ComboLegView {
  key: string;
  match: string;
  label: string;
  price: number | null;
  result: PickResult | null;
}

interface Props {
  title: string;
  meta: string;
  legs: ComboLegView[];
  jointProb: number;
  totalPrice: number | null;
  result: PickResult | null;
  units: number;
  labels: ResultLabels & { jointProb: string; totalOdds: string };
  action?: ReactNode;
}

/** Tarjeta de una combinada (del sistema o del usuario) con el resultado de cada selección. */
export function ComboCard({ title, meta, legs, jointProb, totalPrice, result, units, labels, action }: Props) {
  return (
    <article className="card flex flex-col p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="num text-xs text-faint">{meta}</p>
        </div>
        <ResultBadge result={result} labels={labels} />
      </header>

      <ul className="mt-3 flex-1 space-y-2">
        {legs.map((leg) => (
          <li key={leg.key} className="rounded-sm border border-border bg-bg px-3 py-2">
            <p className="text-xs text-muted">{leg.match}</p>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm">{leg.label}</p>
              <span className="flex shrink-0 items-center gap-2">
                <span className="num text-sm text-muted">{odds(leg.price)}</span>
                <ResultBadge result={leg.result} labels={labels} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <footer className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
        <dl className="flex gap-5">
          <div>
            <dt className="text-xs text-faint">{labels.jointProb}</dt>
            <dd className="num text-lg">{pct(jointProb)}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">{labels.totalOdds}</dt>
            <dd className="num text-lg">{odds(totalPrice)}</dd>
          </div>
        </dl>
        {result ? <span className={`num text-lg font-semibold ${result === 'acierto' ? 'text-acierto' : result === 'fallo' ? 'text-fallo' : 'text-nulo'}`}>{fmtUnits(units)}u</span> : action}
      </footer>
    </article>
  );
}
