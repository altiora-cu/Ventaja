'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Escudo del equipo. Se carga directo del proveedor (sin el optimizador de Next: los escudos vienen de varios
 * dominios y en SVG o PNG, y el optimizador los rechazaba con 400). Si falla o no hay escudo, muestra la inicial.
 */
export function TeamLogo({ src, name, size = 40, className }: { src: string | null | undefined; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-hover text-muted font-semibold', className)} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
        {name.slice(0, 1)}
      </span>
    );
  }
  return <Image src={src} alt="" unoptimized width={size} height={size} className={cn('shrink-0 object-contain', className)} style={{ width: size, height: size }} onError={() => setFailed(true)} />;
}
