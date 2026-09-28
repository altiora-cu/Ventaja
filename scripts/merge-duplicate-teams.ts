/**
 * Detecta equipos duplicados (mismo nombre normalizado con el normalizador actual, o similitud alta)
 * y los fusiona: reasigna fixtures y team_stats al equipo canónico, crea el alias y borra el duplicado.
 *
 * Uso: pnpm teams:dedupe            (solo muestra qué haría)
 *      pnpm teams:dedupe --apply    (ejecuta)
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'] });

interface TeamRow {
  id: number;
  name: string;
  slug: string | null;
  logo: string | null;
  source: string | null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { normalizeName, nameSimilarity } = await import('@/lib/data/matching');
  const admin = createAdminClient();

  const { data: teams, error } = await admin.from('teams').select('id,name,slug,logo,source').order('id').returns<TeamRow[]>();
  if (error) throw error;
  const rows = teams ?? [];

  // Grupos por slug recalculado con el normalizador actual
  const groups = new Map<string, TeamRow[]>();
  for (const t of rows) {
    const slug = normalizeName(t.name);
    groups.set(slug, [...(groups.get(slug) ?? []), t]);
  }
  const pairs: Array<{ keep: TeamRow; drop: TeamRow; reason: string }> = [];
  for (const [, g] of groups) {
    if (g.length < 2) continue;
    // Canónico: el que tiene logo, si no el de id más bajo
    const sorted = [...g].sort((a, b) => Number(Boolean(b.logo)) - Number(Boolean(a.logo)) || a.id - b.id);
    for (const d of sorted.slice(1)) pairs.push({ keep: sorted[0], drop: d, reason: 'mismo nombre normalizado' });
  }
  // Similitud alta entre slugs distintos (sugerencia, no automática salvo ≥ 0.9)
  const uniques = [...groups.entries()].map(([slug, g]) => ({ slug, t: g[0] }));
  for (let i = 0; i < uniques.length; i++) {
    for (let j = i + 1; j < uniques.length; j++) {
      const s = nameSimilarity(uniques[i].t.name, uniques[j].t.name);
      if (s >= 0.9) {
        const [keep, drop] = [uniques[i].t, uniques[j].t].sort((a, b) => Number(Boolean(b.logo)) - Number(Boolean(a.logo)) || a.id - b.id);
        pairs.push({ keep, drop, reason: `similitud ${s.toFixed(2)}` });
      }
    }
  }

  if (!pairs.length) {
    console.log('Sin duplicados.');
    return;
  }
  console.log(`${pairs.length} fusiones ${apply ? 'a ejecutar' : 'propuestas (usa --apply para ejecutar)'}:`);
  for (const p of pairs) console.log(`  #${p.drop.id} "${p.drop.name}" → #${p.keep.id} "${p.keep.name}"  (${p.reason})`);
  if (!apply) return;

  for (const { keep, drop } of pairs) {
    const aliasSlug = normalizeName(drop.name);
    const keepSlug = keep.slug ?? normalizeName(keep.name);
    await admin.from('fixtures').update({ home_id: keep.id }).eq('home_id', drop.id);
    await admin.from('fixtures').update({ away_id: keep.id }).eq('away_id', drop.id);
    await admin.from('team_stats').delete().eq('team_id', drop.id); // se recalcula en la próxima ingesta
    await admin.from('player_stats').update({ team_id: keep.id }).eq('team_id', drop.id);
    await admin.from('injuries').update({ team_id: keep.id }).eq('team_id', drop.id);
    await admin.from('lineups').delete().eq('team_id', drop.id);
    if (aliasSlug !== keepSlug) await admin.from('team_aliases').upsert({ alias: aliasSlug, slug: keepSlug, source: drop.source });
    if (!keep.slug) await admin.from('teams').update({ slug: keepSlug }).eq('id', keep.id);
    const { error: delErr } = await admin.from('teams').delete().eq('id', drop.id);
    if (delErr) console.error(`  No se pudo borrar #${drop.id}: ${delErr.message}`);
    else console.log(`  ✓ #${drop.id} fusionado en #${keep.id}`);
  }
  console.log('Listo. Corre `pnpm ingest:check --skip-run` o espera al cron para recalcular team_stats.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
