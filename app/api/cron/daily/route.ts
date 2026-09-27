import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { ingestFixtures, ingestLineups, ingestStats } from '@/lib/data/ingest';
import { ingestOdds } from '@/lib/data/odds-ingest';
import { runPredictions } from '@/lib/data/predict';
import { settlePicks } from '@/lib/data/settle';
import { runAccounts } from '@/lib/data/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron diario único (plan Hobby de Vercel): calendario + resultados → estadísticas → cuotas →
 * predicciones y Lecturas → cierre de picks → cuentas y recordatorios.
 * Cada paso captura su propio error para que un fallo no impida los siguientes.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('daily', async () => {
    const out: Record<string, unknown> = {};
    const step = async (name: string, fn: () => Promise<unknown>) => {
      try {
        out[name] = await fn();
      } catch (e) {
        out[name] = { error: (e as Error).message };
      }
    };
    await step('fixtures', () => ingestFixtures(7));
    await step('stats', ingestStats);
    await step('odds', ingestOdds);
    await step('lineups', ingestLineups);
    await step('predict', () => runPredictions());
    await step('settle', settlePicks);
    await step('accounts', () => runAccounts());
    return out;
  });
}

export const POST = GET;
