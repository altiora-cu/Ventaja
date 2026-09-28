import 'server-only';

/**
 * Fuentes para satori (Vercel OG). Se descargan de Google Fonts en runtime y se cachean en memoria.
 * Fallback: sin fuente personalizada (satori usa la por defecto).
 */
const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function loadGoogleFont(family: string, weight: number, text?: string): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}:${text ? 'sub' : 'full'}`;
  if (!cache.has(key)) {
    const pending = (async () => {
      try {
        const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
        // Sin User-Agent moderno, Google Fonts sirve TTF (satori no soporta woff2).
        const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VentajaOG/1.0)' } })).text();
        const match = css.match(/src: url\((.+?)\) format\('(truetype|opentype)'\)/);
        if (!match) return null;
        const buf = await (await fetch(match[1])).arrayBuffer();
        // Firma TTF/OTF: 0x00010000 o 'OTTO'. Descartar cualquier otro contenedor.
        const sig = new DataView(buf).getUint32(0);
        return sig === 0x00010000 || sig === 0x4f54544f ? buf : null;
      } catch {
        return null;
      }
    })();
    cache.set(key, pending);
    // Un fallo no se queda en caché: la siguiente petición vuelve a intentar la descarga.
    void pending.then((font) => {
      if (!font && cache.get(key) === pending) cache.delete(key);
    });
  }
  return cache.get(key)!;
}

export async function ogFonts(): Promise<Array<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: 'normal' }>> {
  const [ui400, ui600, mono500] = await Promise.all([loadGoogleFont('Inter Tight', 400), loadGoogleFont('Inter Tight', 600), loadGoogleFont('JetBrains Mono', 500)]);
  const fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: 'normal' }> = [];
  if (ui400) fonts.push({ name: 'Inter Tight', data: ui400, weight: 400, style: 'normal' });
  if (ui600) fonts.push({ name: 'Inter Tight', data: ui600, weight: 600, style: 'normal' });
  if (mono500) fonts.push({ name: 'JetBrains Mono', data: mono500, weight: 500, style: 'normal' });
  return fonts;
}

export const OG_COLORS = {
  bg: '#0B0F14',
  elevated: '#111720',
  border: '#1F2933',
  text: '#E8ECF1',
  muted: '#8B96A5',
  faint: '#55606E',
  ventaja: '#2EE59D',
  ventajaDim: '#1A7A57',
  media: '#F5B841',
  baja: '#8B96A5',
};
