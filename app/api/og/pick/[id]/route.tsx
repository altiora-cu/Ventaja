import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { OG_COLORS as C, ogFonts } from '@/lib/og/fonts';
import { getFixtureDetail } from '@/lib/data/queries';
import { getViewer } from '@/lib/auth/viewer';
import { selectionLabel } from '@/lib/labels';
import { isFinished } from '@/lib/data/statuses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELLO = { alta: { label: 'ALTA', color: C.ventaja, bg: 'rgba(46,229,157,0.10)', border: C.ventajaDim }, media: { label: 'MEDIA', color: C.media, bg: 'rgba(245,184,65,0.10)', border: 'rgba(245,184,65,0.35)' }, baja: { label: 'BAJA', color: C.baja, bg: 'rgba(139,150,165,0.10)', border: 'rgba(139,150,165,0.3)' } };

/** og-pick dinámico 1080×1350: pick + sello + wordmark abajo a la derecha. Cada captura compartida es publicidad. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const detail = await getFixtureDetail(id);
  if (!detail) return new Response('Not found', { status: 404 });
  const { fixture: f, analysis } = detail;
  const top = analysis?.top_market;
  // Los picks de partidos por jugar son contenido de pago: solo con acceso vigente (los finalizados son públicos).
  if (!isFinished(f.status)) {
    const viewer = await getViewer();
    if (!viewer.access.canAccess) return new Response('Unauthorized', { status: 401 });
  }
  const fonts = await ogFonts();
  const pick = top ? selectionLabel(top.market, top.selection, top.line, { home: f.home.name, away: f.away.name, player: top.player_name }, 'es') : null;
  const s = SELLO[top?.sello ?? 'baja'];
  const kickoff = new Intl.DateTimeFormat('es-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(f.kickoff));
  const pct = (p: number | null | undefined) => (p == null ? '—' : `${Math.round(p * 100)}%`);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, padding: 64, fontFamily: 'Inter Tight' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.muted, fontSize: 26 }}>
          <span>{f.league.name}</span>
          <span style={{ fontFamily: 'JetBrains Mono' }}>{kickoff} ET</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 56 }}>
          {[f.home, f.away].map((team) => (
            <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              {team.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logo} width={96} height={96} alt="" style={{ objectFit: 'contain' }} />
              ) : (
                <div style={{ display: 'flex', width: 96, height: 96, borderRadius: 48, background: C.elevated }} />
              )}
              <span style={{ fontSize: 60, fontWeight: 600, letterSpacing: '-0.02em' }}>{team.name}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', background: C.elevated, border: `2px solid ${C.border}`, borderRadius: 24, padding: 44 }}>
          <span style={{ fontSize: 24, color: C.ventaja, fontWeight: 600, letterSpacing: '0.06em' }}>LECTURA DE VENTAJA</span>
          <span style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 12, lineHeight: 1.1 }}>{pick ?? 'Análisis disponible en la app'}</span>
          <div style={{ display: 'flex', gap: 48, marginTop: 36, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, color: C.faint }}>Probabilidad</span>
              <span style={{ fontSize: 64, fontFamily: 'JetBrains Mono', lineHeight: 1.1 }}>{pct(top?.prob)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, color: C.faint }}>Mejor cuota</span>
              <span style={{ fontSize: 64, fontFamily: 'JetBrains Mono', lineHeight: 1.1 }}>{top?.best_price ? Number(top.best_price).toFixed(2) : '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, color: C.faint }}>Ventaja</span>
              <span style={{ fontSize: 64, fontFamily: 'JetBrains Mono', lineHeight: 1.1, color: C.ventaja }}>{top?.edge != null ? `${top.edge > 0 ? '+' : ''}${(top.edge * 100).toFixed(1)}%` : '—'}</span>
            </div>
            <div style={{ display: 'flex', marginLeft: 'auto', alignItems: 'center', gap: 12, height: 56, padding: '0 22px', borderRadius: 16, background: s.bg, border: `2px solid ${s.border}`, color: s.color, fontSize: 26, fontWeight: 600, letterSpacing: '0.06em' }}>
              <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: s.color }} />
              {s.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 }}>
          <span style={{ fontSize: 22, color: C.faint }}>Análisis estadístico · 21+ · Juega con responsabilidad</span>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em' }}>
            <span style={{ color: C.ventaja }}>V</span>entaja
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts, headers: { 'Cache-Control': 'public, max-age=900' } },
  );
}
