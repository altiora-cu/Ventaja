import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { searchFixtures } from '@/lib/data/queries';
import { isFinished } from '@/lib/data/statuses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const [results, viewer] = await Promise.all([searchFixtures(q), getViewer()]);
  const canAccess = viewer.access.canAccess;
  return NextResponse.json(
    results.map((r) => ({
      id: r.id,
      kickoff: r.kickoff,
      status: r.status,
      league: r.league.name,
      home: { name: r.home.name, logo: r.home.logo },
      away: { name: r.away.name, logo: r.away.logo },
      home_goals: r.home_goals,
      away_goals: r.away_goals,
      pick: r.pick ? { market: r.pick.market, selection: r.pick.selection, line: r.pick.line, player_name: r.pick.player_name, result: r.pick.result, price: r.pick.price } : null,
      // El mercado principal de un partido por jugar es contenido de pago: solo con acceso vigente.
      top: canAccess || isFinished(r.status) ? r.analysis?.top_market ?? null : null,
    })),
  );
}
