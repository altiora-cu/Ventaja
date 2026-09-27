import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { runPredictions } from '@/lib/data/predict';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('predict', () => runPredictions(request.nextUrl.searchParams.get('date') ?? undefined));
}

export const POST = GET;
