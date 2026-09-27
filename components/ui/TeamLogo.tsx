import Image from 'next/image';
import { cn } from '@/lib/utils';

export function TeamLogo({ src, name, size = 40, className }: { src: string | null | undefined; name: string; size?: number; className?: string }) {
  if (!src) {
    return (
      <span className={cn('inline-flex items-center justify-center rounded-full bg-hover text-muted font-semibold', className)} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
        {name.slice(0, 1)}
      </span>
    );
  }
  return <Image src={src} alt={name} width={size} height={size} className={cn('object-contain', className)} style={{ width: size, height: size }} />;
}
