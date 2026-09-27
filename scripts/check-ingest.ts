/**
 * Diagnóstico de la primera ingesta. Ejecuta el ciclo completo (calendario + estadísticas →
 * partidos próximos → cuotas → predicciones) y reporta qué se cargó y qué falta.
 *
 * Uso: pnpm ingest:check            (lee .env.local)
 *      pnpm ingest:check --skip-run  (solo reporte, sin llamar a las APIs)
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ODDS_API_KEY. Opcionales: FOOTBALL_DATA_KEY
 * (Premier completa), API_FOOTBALL_KEY con DATA_SOURCE=api_football, ANTHROPIC_API_KEY (Lecturas y Revisión IA).
 */
import { config as loadEnv } from 'dotenv';

// Carga .env.local (prioridad) y .env, desde la raíz del proyecto.
loadEnv({ path: ['.env.local', '.env'] });

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ODDS_API_KEY'] as const;

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

async function main() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Faltan variables: ${missing.join(', ')}. Ponlas en .env.local (ver docs/SUPABASE_SETUP.md).`);
    process.exit(1);
  }
  const skipRun = process.argv.includes('--skip-run');

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  // 0. Conexión y esquema
  section('Fuente de datos');
  console.log(process.env.DATA_SOURCE === 'api_football' ? 'API-Football (DATA_SOURCE=api_football)' : `The Odds API${process.env.FOOTBALL_DATA_KEY ? ' + football-data.org (Premier)' : ' (sin FOOTBALL_DATA_KEY: la Premier también sale de The Odds API)'}`);

  section('Conexión a Supabase');
  const { data: leagues, error: lErr } = await admin.from('leagues').select('id,name,season,odds_sport_key,fd_code,active').order('id');
  if (lErr) {
    console.error('No se pudo leer `leagues`. ¿Ejecutaste supabase/migrations/0001_init.sql?', lErr.message);
    process.exit(1);
  }
  console.table(leagues);

  if (!skipRun) {
    const { ingestStats, ingestFixtures } = await import('@/lib/data/ingest');
    const { ingestOdds } = await import('@/lib/data/odds-ingest');
    const { runPredictions } = await import('@/lib/data/predict');

    section('1/4 Calendario + resultados + estadísticas');
    const stats = await ingestStats();
    console.log(JSON.stringify({ ...stats, skipped: stats.skipped.length }, null, 2));
    if (stats.errors.length) console.error('Errores:', stats.errors);

    section('2/4 Partidos próximos 7 días');
    const fx = await ingestFixtures(7);
    console.log(JSON.stringify({ ...fx, skipped: fx.skipped.length }, null, 2));
    if (fx.errors.length) console.error('Errores:', fx.errors);

    section('3/4 Cuotas (The Odds API)');
    const odds = await ingestOdds();
    console.log(JSON.stringify({ ...odds, skipped: odds.skipped }, null, 2));
    if (odds.usage.remaining !== null) console.log(`Créditos restantes de The Odds API: ${odds.usage.remaining}`);
    if (odds.errors.length) console.error('Errores:', odds.errors);

    section('4/4 Predicciones + Lecturas');
    const pred = await runPredictions();
    console.log(JSON.stringify(pred, null, 2));
  }

  // Reporte
  section('Reporte');
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const [{ count: teams }, { count: fixturesTotal }, { count: finishedWithStats }, { count: teamStats }, { count: players }, { count: predictions }, { count: analyses }] = await Promise.all([
    admin.from('teams').select('id', { count: 'exact', head: true }),
    admin.from('fixtures').select('id', { count: 'exact', head: true }),
    admin.from('fixtures').select('id', { count: 'exact', head: true }).in('status', ['FT', 'AET', 'PEN']).not('stats', 'is', null),
    admin.from('team_stats').select('team_id', { count: 'exact', head: true }),
    admin.from('player_stats').select('player_id', { count: 'exact', head: true }),
    admin.from('predictions').select('id', { count: 'exact', head: true }),
    admin.from('fixture_analysis').select('fixture_id', { count: 'exact', head: true }),
  ]);
  console.table({ equipos: teams, partidos_total: fixturesTotal, terminados_con_stats: finishedWithStats, team_stats: teamStats, jugadores: players, predicciones: predictions, analisis: analyses });

  const { data: upcoming } = await admin
    .from('fixtures')
    .select('id,kickoff,league_id,status,home:teams!fixtures_home_id_fkey(name),away:teams!fixtures_away_id_fkey(name)')
    .gte('kickoff', now.toISOString())
    .lte('kickoff', in7)
    .order('kickoff')
    .returns<Array<{ id: number; kickoff: string; league_id: number; status: string; home: { name: string }; away: { name: string } }>>();
  const ids = (upcoming ?? []).map((f) => f.id);
  const { data: withOdds } = ids.length ? await admin.from('odds').select('fixture_id').in('fixture_id', ids) : { data: [] };
  const oddsSet = new Set((withOdds ?? []).map((o) => o.fixture_id));
  const { data: withPred } = ids.length ? await admin.from('fixture_analysis').select('fixture_id,top_market').in('fixture_id', ids) : { data: [] };
  const predMap = new Map((withPred ?? []).map((p) => [p.fixture_id, p.top_market as { sello?: string } | null]));
  const leagueName = new Map((leagues ?? []).map((l) => [l.id, l.name]));

  section(`Próximos 7 días: ${ids.length} partidos`);
  const byLeague = new Map<number, { total: number; conCuotas: number; conPrediccion: number; sinCuotas: string[] }>();
  for (const f of upcoming ?? []) {
    const e = byLeague.get(f.league_id) ?? { total: 0, conCuotas: 0, conPrediccion: 0, sinCuotas: [] };
    e.total++;
    if (oddsSet.has(f.id)) e.conCuotas++;
    else e.sinCuotas.push(`${f.home.name} vs ${f.away.name} (${f.kickoff.slice(0, 16)})`);
    if (predMap.has(f.id)) e.conPrediccion++;
    byLeague.set(f.league_id, e);
  }
  for (const [lid, e] of byLeague) {
    const l = (leagues ?? []).find((x) => x.id === lid);
    console.log(`\n${leagueName.get(lid)} · ${e.total} partidos · ${e.conCuotas} con cuotas · ${e.conPrediccion} con predicción${l?.odds_sport_key ? '' : ' · (liga sin cobertura de The Odds API: solo probabilidades)'}`);
    if (l?.odds_sport_key && e.sinCuotas.length) {
      console.log('  Sin cuotas (revisar emparejado de nombres en lib/data/matching.ts):');
      for (const s of e.sinCuotas.slice(0, 10)) console.log(`   - ${s}`);
    }
  }

  const sellos = { alta: 0, media: 0, baja: 0, sin: 0 };
  for (const f of upcoming ?? []) {
    const s = predMap.get(f.id)?.sello;
    if (!s) sellos.sin++;
    else sellos[s as 'alta' | 'media' | 'baja']++;
  }
  section('Sello del pick principal (próximos 7 días)');
  console.table(sellos);

  const { data: bySource } = await admin.from('fixtures').select('source').returns<Array<{ source: string | null }>>();
  const srcCount: Record<string, number> = {};
  for (const r of bySource ?? []) srcCount[r.source ?? 'sin_fuente'] = (srcCount[r.source ?? 'sin_fuente'] ?? 0) + 1;
  section('Partidos por fuente');
  console.table(srcCount);

  const { data: log } = await admin.from('ingest_log').select('key,fetched_at').order('fetched_at', { ascending: false }).limit(12);
  section('Últimas llamadas cacheadas (ingest_log)');
  console.table(log);

  console.log('\nListo. Si "con cuotas" es 0 en una liga con cobertura, revisa ODDS_API_KEY y la cuota restante (usage arriba).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
