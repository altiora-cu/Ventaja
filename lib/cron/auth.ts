import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Todos los /api/cron/* rechazan sin CRON_SECRET.
 * Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`; también aceptamos `x-cron-secret` para pruebas manuales.
 */
/** Comparación en tiempo constante; se comparan los hashes para que el largo tampoco se filtre. */
function safeEqual(received: string | null, expected: string): boolean {
  if (received === null) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

export function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  const auth = request.headers.get('authorization');
  const header = request.headers.get('x-cron-secret');
  const ok = safeEqual(auth, `Bearer ${secret}`) || safeEqual(header, secret);
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return null;
}

export async function runJob<T>(name: string, job: () => Promise<T>): Promise<NextResponse> {
  const started = Date.now();
  try {
    const result = await job();
    return NextResponse.json({ ok: true, job: name, ms: Date.now() - started, result });
  } catch (e) {
    console.error(`[cron:${name}]`, e);
    return NextResponse.json({ ok: false, job: name, ms: Date.now() - started, error: 'El job falló; el detalle está en los logs del servidor' }, { status: 500 });
  }
}
