import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataSource, Team } from '@/lib/db/types';
import { normalizeName } from './matching';

/**
 * Identidad de equipos entre proveedores: un equipo por `slug` (nombre normalizado), con tabla de alias
 * para los nombres que no coinciden (ej. "Man Utd" → "manchester united").
 */
export class TeamResolver {
  private bySlug = new Map<string, Team>();
  private aliases = new Map<string, string>();
  private loaded = false;

  constructor(private admin: SupabaseClient) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    const [{ data: teams }, { data: aliases }] = await Promise.all([
      this.admin.from('teams').select('*').returns<Team[]>(),
      this.admin.from('team_aliases').select('alias,slug').returns<Array<{ alias: string; slug: string }>>(),
    ]);
    for (const t of teams ?? []) {
      const slug = t.slug ?? normalizeName(t.name);
      this.bySlug.set(slug, t);
    }
    for (const a of aliases ?? []) this.aliases.set(a.alias, a.slug);
    this.loaded = true;
  }

  slugFor(name: string): string {
    const n = normalizeName(name);
    return this.aliases.get(n) ?? n;
  }

  /** Devuelve el equipo existente o lo crea (id de la secuencia propia). Actualiza logo/slug si faltaban. */
  async resolve(name: string, source: DataSource, extra: { logo?: string | null; external_id?: string | null; country?: string | null } = {}): Promise<Team> {
    await this.load();
    const slug = this.slugFor(name);
    const existing = this.bySlug.get(slug);
    if (existing) {
      const patch: Partial<Team> = {};
      if (!existing.slug) patch.slug = slug;
      if (!existing.logo && extra.logo) patch.logo = extra.logo;
      if (!existing.external_id && extra.external_id) {
        patch.external_id = extra.external_id;
        patch.source = source;
      }
      if (Object.keys(patch).length) {
        await this.admin.from('teams').update(patch).eq('id', existing.id);
        Object.assign(existing, patch);
      }
      return existing;
    }
    const { data: idRow, error: idErr } = await this.admin.rpc('next_team_id');
    if (idErr) throw idErr;
    const team: Team = {
      id: Number(idRow),
      name,
      short_name: null,
      logo: extra.logo ?? null,
      country: extra.country ?? null,
      slug,
      source,
      external_id: extra.external_id ?? null,
    };
    const { error } = await this.admin.from('teams').insert(team);
    if (error) throw error;
    this.bySlug.set(slug, team);
    return team;
  }
}
