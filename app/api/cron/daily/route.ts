import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { ingestFixtures, ingestLineups, ingestStats } from '@/lib/data/ingest';
import { ingestOdds } from '@/lib/data/odds-ingest';
import { runPredictions } from '@/lib/data/predict';
import { settlePicks } from '@/lib/data/settle';
import { registerSystemCombos, settleUserPlays } from '@/lib/data/settle-user';
import { runAccounts } from '@/lib/data/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron diario único (plan Hobby de Vercel): calendario + resultados → cierre de picks, jugadas y combinadas →
 * estadísticas → cuotas → predicciones y Lecturas → registro de combinadas → cuentas y recordatorios.
 * El cierre va antes de las predicciones: es rápido y no debe perderse si el paso de IA agota el tiempo.
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
    await step('settle', settlePicks);
    await step('settleUser', settleUserPlays);
    await step('stats', ingestStats);
    await step('odds', ingestOdds);
    await step('lineups', ingestLineups);
    await step('predict', () => runPredictions());
    await step('combos', () => registerSystemCombos());
    await step('accounts', () => runAccounts());
    return out;
  });
}

export const POST = GET;
