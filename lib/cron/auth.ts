import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Todos los /api/cron/* rechazan sin CRON_SECRET.
 * Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`; también aceptamos `x-cron-secret` para pruebas manuales.
 */
export function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  const auth = request.headers.get('authorization');
  const header = request.headers.get('x-cron-secret');
  const ok = auth === `Bearer ${secret}` || header === secret;
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
    return NextResponse.json({ ok: false, job: name, ms: Date.now() - started, error: (e as Error).message }, { status: 500 });
  }
}
