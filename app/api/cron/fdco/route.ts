import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { ingestFdco } from '@/lib/data/fdco-ingest';
import { runPredictions } from '@/lib/data/predict';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Segunda pasada del día (tarde): football-data.co.uk publica las cuotas del fin de semana el viernes ≤ 17:00
 * y las de entre semana el martes ≤ 13:00 (hora de Reino Unido), después del cron de la mañana. Esta pasada las
 * recoge y recalcula las predicciones. No llama a The Odds API: no gasta créditos.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('fdco', async () => {
    const fdco = await ingestFdco();
    const predict = fdco.oddsFixtures > 0 || fdco.statsUpdated > 0 ? await runPredictions() : { skipped: 'sin datos nuevos' };
    return { fdco, predict };
  });
}

export const POST = GET;
