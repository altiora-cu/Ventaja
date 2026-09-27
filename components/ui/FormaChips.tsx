/** Últimos 5 resultados (W/D/L), más reciente a la derecha. */
export function FormaChips({ form, className }: { form: string | null | undefined; className?: string }) {
  const chips = (form ?? '').slice(-5).padStart(5, '·').split('');
  return (
    <span className={`inline-flex gap-1 ${className ?? ''}`} aria-label={form ?? ''}>
      {chips.map((r, i) => (
        <span key={i} className="forma-chip" data-r={r === '·' ? '' : r}>
          {r === '·' ? '' : r}
        </span>
      ))}
    </span>
  );
}
