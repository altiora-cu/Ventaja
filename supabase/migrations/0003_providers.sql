-- =============================================================================
-- VENTAJA · Migración 3: proveedores de datos sin API-Football
-- The Odds API = calendario maestro, cuotas y resultados (5 ligas).
-- football-data.org = temporada completa, descanso y árbitro (Premier League).
-- Idempotente.
-- =============================================================================

-- Identificadores propios para equipos/partidos que no vienen de API-Football (rango alto).
create sequence if not exists public.teams_id_seq start 10000000;
create sequence if not exists public.fixtures_id_seq start 10000000;

alter table public.teams add column if not exists slug text;            -- nombre normalizado (identidad entre proveedores)
alter table public.teams add column if not exists source text;          -- 'api_football' | 'odds_api' | 'football_data'
alter table public.teams add column if not exists external_id text;     -- id en el proveedor (si existe)
create unique index if not exists teams_slug_uidx on public.teams (slug) where slug is not null;

alter table public.fixtures add column if not exists source text;       -- 'api_football' | 'odds_api' | 'football_data'
alter table public.fixtures add column if not exists external_id text;  -- id en el proveedor maestro
alter table public.fixtures add column if not exists odds_event_id text; -- id del evento en The Odds API (cuotas y resultados)
create unique index if not exists fixtures_source_external_uidx on public.fixtures (source, external_id) where external_id is not null;
create index if not exists fixtures_odds_event_idx on public.fixtures (odds_event_id) where odds_event_id is not null;

-- Alias de nombres de equipo entre proveedores (ej. "Man Utd" → "manchester united").
create table if not exists public.team_aliases (
  alias text primary key,            -- nombre normalizado tal como lo entrega un proveedor
  slug text not null,                -- slug canónico en teams
  source text
);
alter table public.team_aliases enable row level security;
drop policy if exists "team_aliases_public_read" on public.team_aliases;
create policy "team_aliases_public_read" on public.team_aliases for select using (true);

-- Ligas: código en football-data.org y baja de Perú (sin cobertura en los proveedores nuevos).
alter table public.leagues add column if not exists fd_code text;
update public.leagues set fd_code = 'PL' where id = 39;
update public.leagues set active = false where id in (281, 282);

-- Limpiar descargas de jugadores marcadas como correctas aunque fallaron por plan.
delete from public.ingest_log where key like 'players:%';

-- Ids nuevos desde el servidor (evita depender de permisos de secuencia en el cliente).
create or replace function public.next_team_id() returns bigint language sql security definer set search_path = public as $$
  select nextval('public.teams_id_seq');
$$;
create or replace function public.next_fixture_id() returns bigint language sql security definer set search_path = public as $$
  select nextval('public.fixtures_id_seq');
$$;
revoke all on function public.next_team_id() from public, anon, authenticated;
revoke all on function public.next_fixture_id() from public, anon, authenticated;
