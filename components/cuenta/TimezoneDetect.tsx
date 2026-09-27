'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Detecta la zona horaria del navegador, la guarda en cookie y muestra su nombre. */
export function TimezoneDetect({ current }: { current: string }) {
  const router = useRouter();
  const [tz, setTz] = useState(current);
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== current) {
      document.cookie = `tz=${encodeURIComponent(detected)}; path=/; max-age=31536000; samesite=lax`;
      setTz(detected);
      router.refresh();
    }
  }, [current, router]);
  return <span className="num text-sm">{tz.replace(/_/g, ' ')}</span>;
}
