'use client';

import { useTranslations } from 'next-intl';
import { IconShare } from '@/components/ui/Icons';

/** Compartir: genera imagen 1080×1350 con el pick y el sello (ruta OG) y usa Web Share si existe. */
export function ShareButton({ fixtureId, title }: { fixtureId: number; title: string }) {
  const t = useTranslations('partido');
  const url = `/api/og/pick/${fixtureId}`;
  const onShare = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `ventaja-${fixtureId}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${title} · Ventaja` });
        return;
      }
    } catch {
      // continuar con descarga
    }
    window.open(url, '_blank', 'noopener');
  };
  return (
    <button type="button" onClick={onShare} className="btn btn-secondary btn-sm" title={t('shareHint')}>
      <IconShare width={16} height={16} />
      {t('shareTitle')}
    </button>
  );
}
