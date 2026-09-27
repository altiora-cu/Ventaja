import { ImageResponse } from 'next/og';
import { OG_COLORS as C, ogFonts } from '@/lib/og/fonts';

export const runtime = 'nodejs';
export const alt = 'Ventaja — Tu ventaja antes del pitazo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** og-default: fondo --bg, wordmark, tagline. */
export default async function OgDefault() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: C.bg, color: C.text, padding: 72, fontFamily: 'Inter Tight' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 16, background: C.elevated, border: `2px solid ${C.border}`, alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <path d="M8 9 L16 25 L24 9" stroke={C.ventaja} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 600, letterSpacing: '-0.03em' }}>
            <span style={{ color: C.ventaja }}>V</span>entaja
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 84, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Tu ventaja antes del pitazo.</div>
          <div style={{ fontSize: 30, color: C.muted }}>Sala de análisis estadístico de fútbol · Lectura, probabilidades y Sello de Confianza.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.faint }}>
          <span>ventaja.app</span>
          <span>Análisis estadístico · 21+ · Juega con responsabilidad</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
