import type { NextRequest } from 'next/server';
import { authorizeCron, runJob } from '@/lib/cron/auth';
import { ingestFixtures } from '@/lib/data/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runJob('fixtures', () => ingestFixtures(7));
}

export const POST = GET;
