import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { ingestOdds } from '@/lib/data/odds-ingest';
import { ingestLineups } from '@/lib/data/ingest';
import { runPredictions } from '@/lib/data/predict';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('odds', async () => {
    const odds = await ingestOdds();
    const lineups = await ingestLineups();
    // Tras las cuotas, recalcular predicciones (sección 7: predict corre tras odds)
    const predict = await runPredictions();
    return { odds, lineups, predict };
  });
}

export const POST = GET;
