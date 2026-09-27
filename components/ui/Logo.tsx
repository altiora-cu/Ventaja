import { cn } from '@/lib/utils';

/** Wordmark: "Ventaja" en Inter Tight 600, tracking -0.03em; la V inicial en --ventaja. */
export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' };
  return (
    <span className={cn('font-semibold tracking-[-0.03em] leading-none select-none', sizes[size], className)} aria-label="Ventaja">
      <span className="text-ventaja">V</span>entaja
    </span>
  );
}

/** Isotipo: "V" geométrica de dos trazos, ángulo 24°, trazo 3px. */
export function Isotipo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--bg)" />
      <path d="M8 9 L16 25 L24 9" stroke="var(--ventaja)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
