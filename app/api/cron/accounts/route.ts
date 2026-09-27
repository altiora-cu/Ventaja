import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { runAccounts } from '@/lib/data/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('accounts', () => runAccounts());
}

export const POST = GET;
