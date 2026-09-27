import type { Config } from 'tailwindcss';

/**
 * Tokens de la dirección A — Sala de análisis.
 * Todos los colores apuntan a variables CSS definidas en app/globals.css
 * para que el sistema tenga una sola fuente de verdad.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './emails/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', lg: '2rem' }, screens: { '2xl': '1200px' } },
    extend: {
      colors: {
        bg: 'var(--bg)',
        elevated: 'var(--bg-elevated)',
        hover: 'var(--bg-hover)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        ventaja: 'var(--ventaja)',
        'ventaja-dim': 'var(--ventaja-dim)',
        'ventaja-bg': 'var(--ventaja-bg)',
        'sello-alta': 'var(--sello-alta)',
        'sello-media': 'var(--sello-media)',
        'sello-baja': 'var(--sello-baja)',
        acierto: 'var(--acierto)',
        fallo: 'var(--fallo)',
        nulo: 'var(--nulo)',
        warning: 'var(--warning)',
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        xl: ['clamp(1.375rem, 1.2rem + 0.8vw, 1.625rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        '2xl': ['clamp(1.75rem, 1.4rem + 1.6vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        '3xl': ['clamp(2.25rem, 1.6rem + 3vw, 3.25rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      },
      spacing: {
        '4.5': '1.125rem',
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '20px',
        btn: '10px',
      },
      boxShadow: {
        none: 'none',
        modal: '0 12px 40px rgba(0,0,0,0.45)',
      },
      maxWidth: { lectura: '62ch', app: '1200px' },
      transitionTimingFunction: { ventaja: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        shimmer: {
          '0%, 100%': { backgroundColor: 'var(--bg-elevated)' },
          '50%': { backgroundColor: 'var(--bg-hover)' },
        },
      },
      animation: { shimmer: 'shimmer 1.4s ease-in-out infinite' },
    },
  },
  plugins: [],
};

export default config;
