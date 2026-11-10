import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { runPushNotifications } from '@/lib/push/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Avisos push: pitazo próximo (ventana PUSH_KICKOFF_HOURS, 24 h por defecto) y resultados recién cerrados. */
export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('push', () => runPushNotifications());
}

export const POST = GET;
