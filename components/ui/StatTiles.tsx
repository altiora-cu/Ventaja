import { cn } from '@/lib/utils';

export interface StatTile {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

/** Fila de indicadores numéricos (2 columnas en móvil, 4 en escritorio). */
export function StatTiles({ tiles, className }: { tiles: StatTile[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {tiles.map((k) => (
        <div key={k.label} className="card p-4">
          <dt className="text-xs text-muted">{k.label}</dt>
          <dd className={cn('num mt-1 text-2xl', k.accent && 'text-ventaja')}>{k.value}</dd>
          {k.hint && <p className="text-xs text-faint">{k.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
