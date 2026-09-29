import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { runPredictions } from '@/lib/data/predict';
import { registerSystemCombos } from '@/lib/data/settle-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('predict', async () => {
    const predict = await runPredictions(request.nextUrl.searchParams.get('date') ?? undefined);
    return { predict, combos: await registerSystemCombos() };
  });
}

export const POST = GET;
