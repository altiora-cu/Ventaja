import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { settlePicks } from '@/lib/data/settle';
import { settleUserPlays } from '@/lib/data/settle-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('settle', async () => ({ picks: await settlePicks(), jugadas: await settleUserPlays() }));
}

export const POST = GET;
