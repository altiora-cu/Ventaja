-- =============================================================================
-- VENTAJA · Migración inicial
-- Auth + perfiles + trial, datos deportivos, cuotas, predicciones e historial.
-- Ejecutar en el SQL Editor de Supabase o con `supabase db push`.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. PERFILES Y NEGOCIO
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'trial' check (status in ('trial','activa','vencida','suspendida')),
  trial_ends_at timestamptz not null,
  paid_until timestamptz,
  locale text default 'es',
  created_at timestamptz default now(),
  last_seen_at timestamptz
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_status_idx on public.profiles (status);

-- Trigger: cada usuario nuevo en auth.users crea su perfil con 31 días de prueba.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, trial_ends_at, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    now() + interval '31 days',
    coalesce(new.raw_user_meta_data->>'locale', 'es')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper para RLS: ¿el usuario autenticado es admin? (security definer evita recursión)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Emails de recordatorio enviados (evita duplicados: uno por usuario y tipo).
create table if not exists public.reminder_emails (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('trial_5','trial_2','trial_0','renew_5','renew_2','renew_0')),
  cycle_key text not null, -- ej. fecha de vencimiento a la que aplica, para renovaciones sucesivas
  sent_at timestamptz default now(),
  unique (user_id, kind, cycle_key)
);

-- -----------------------------------------------------------------------------
-- 2. DATOS DEPORTIVOS (API-Football)
-- -----------------------------------------------------------------------------
create table if not exists public.leagues (
  id int primary key,            -- id de API-Football
  name text not null,
  country text,
  logo text,
  season int not null,
  odds_sport_key text,           -- clave de The Odds API (null si no la cubre)
  active boolean default true
);

create table if not exists public.teams (
  id int primary key,            -- id de API-Football
  name text not null,
  short_name text,
  logo text,
  country text
);
create index if not exists teams_name_idx on public.teams using gin (to_tsvector('simple', name));

create table if not exists public.referees (
  name text primary key,
  cards_avg numeric,             -- tarjetas promedio por partido (amarillas + rojas)
  matches int default 0,
  updated_at timestamptz default now()
);

create table if not exists public.fixtures (
  id int primary key,            -- id de API-Football
  league_id int not null references public.leagues(id),
  season int not null,
  round text,
  kickoff timestamptz not null,
  home_id int not null references public.teams(id),
  away_id int not null references public.teams(id),
  venue text,
  city text,
  referee text,
  status text not null default 'NS',   -- NS, 1H, HT, 2H, FT, AET, PEN, PST, CANC...
  home_goals int,
  away_goals int,
  ht_home_goals int,
  ht_away_goals int,
  stats jsonb,                   -- estadísticas reales del partido (corners, tarjetas, tiros...)
  updated_at timestamptz default now()
);
create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff);
create index if not exists fixtures_league_kickoff_idx on public.fixtures (league_id, kickoff);
create index if not exists fixtures_status_idx on public.fixtures (status);

create table if not exists public.team_stats (
  team_id int not null references public.teams(id),
  league_id int not null references public.leagues(id),
  season int not null,
  played int default 0,
  wins int default 0,
  draws int default 0,
  losses int default 0,
  gf int default 0,
  gc int default 0,
  xg numeric,
  xga numeric,
  corners_for numeric,
  corners_against numeric,
  cards_for numeric,
  cards_against numeric,
  shots_for numeric,
  shots_against numeric,
  sot_for numeric,
  sot_against numeric,
  home jsonb,                    -- desglose local: {played, gf, gc, xg, xga, ...}
  away jsonb,                    -- desglose visita
  halves jsonb,                  -- {ht_gf, ht_gc, sh_gf, sh_gc}
  form text,                     -- 'WWDLW' últimos 5 (más reciente al final)
  recent jsonb,                  -- últimos 10 partidos: [{fixture_id, date, home, gf, gc, xg, xga, result}]
  elo numeric default 1500,
  updated_at timestamptz default now(),
  primary key (team_id, league_id, season)
);

create table if not exists public.player_stats (
  player_id int not null,
  team_id int not null references public.teams(id),
  league_id int not null references public.leagues(id),
  season int not null,
  name text not null,
  position text,
  photo text,
  appearances int default 0,
  lineups int default 0,
  minutes int default 0,
  goals int default 0,
  xg numeric,
  shots numeric,
  sot numeric,
  updated_at timestamptz default now(),
  primary key (player_id, team_id, league_id, season)
);
create index if not exists player_stats_team_idx on public.player_stats (team_id, season);

create table if not exists public.lineups (
  fixture_id int not null references public.fixtures(id) on delete cascade,
  team_id int not null references public.teams(id),
  formation text,
  starters jsonb,                -- [{player_id, name, pos}]
  bench jsonb,
  updated_at timestamptz default now(),
  primary key (fixture_id, team_id)
);

create table if not exists public.injuries (
  id bigserial primary key,
  fixture_id int references public.fixtures(id) on delete cascade,
  team_id int not null references public.teams(id),
  player_id int,
  player_name text,
  type text,                     -- 'Missing Fixture' | 'Questionable'
  reason text,
  updated_at timestamptz default now(),
  unique (fixture_id, team_id, player_id)
);

-- -----------------------------------------------------------------------------
-- 3. CUOTAS (The Odds API)
-- -----------------------------------------------------------------------------
create table if not exists public.odds (
  id bigserial primary key,
  fixture_id int not null references public.fixtures(id) on delete cascade,
  bookmaker text not null,
  market text not null,          -- '1x2' | 'totals' | 'ah' | 'btts' | 'dc' ...
  selection text not null,       -- 'home' | 'draw' | 'away' | 'over' | 'under' | 'yes' | 'no' | 'ah_home' | ...
  line numeric,                  -- 2.5, -0.5 ...
  price numeric not null,        -- cuota decimal
  fetched_at timestamptz default now(),
  unique (fixture_id, bookmaker, market, selection, line)
);
create index if not exists odds_fixture_idx on public.odds (fixture_id, market);

-- -----------------------------------------------------------------------------
-- 4. PREDICCIONES E HISTORIAL
-- -----------------------------------------------------------------------------
create table if not exists public.predictions (
  id bigserial primary key,
  fixture_id int not null references public.fixtures(id) on delete cascade,
  market text not null,
  selection text not null,
  line numeric,
  player_id int,
  player_name text,
  prob numeric not null,         -- 0..1
  best_price numeric,            -- mejor cuota entre casas
  best_bookmaker text,
  implied_prob numeric,          -- sin margen
  edge numeric,                  -- prob - implied_prob (null si no hay cuota)
  sello text not null check (sello in ('alta','media','baja')),
  calculated_at timestamptz default now(),
  unique (fixture_id, market, selection, line, player_id)
);
create index if not exists predictions_fixture_idx on public.predictions (fixture_id);
create index if not exists predictions_sello_idx on public.predictions (sello, edge desc);

-- Resumen por partido: lectura, marcadores, λ, pick principal.
create table if not exists public.fixture_analysis (
  fixture_id int primary key references public.fixtures(id) on delete cascade,
  lambda_home numeric,
  lambda_away numeric,
  scores jsonb,                  -- top 4: [{home, away, prob}]
  lectura text,                  -- Lectura en español
  lectura_en text,               -- Lectura en inglés
  lectura_locale text default 'es',
  lectura_sello text,            -- sello del pick principal al generar la lectura (regenerar solo si cambia)
  top_market jsonb,              -- {market, selection, line, prob, best_price, edge, sello}
  calculated_at timestamptz default now()
);

create table if not exists public.picks_history (
  id bigserial primary key,
  fixture_id int not null references public.fixtures(id) on delete cascade,
  market text not null,
  selection text not null,
  line numeric,
  player_id int,
  player_name text,
  prob numeric not null,
  price numeric,                 -- cuota cerrada
  sello text not null,
  result text not null check (result in ('acierto','fallo','nulo')),
  units numeric not null default 0, -- +(price-1) acierto, -1 fallo, 0 nulo (stake 1u)
  settled_at timestamptz default now(),
  unique (fixture_id, market, selection, line, player_id)
);
create index if not exists picks_history_settled_idx on public.picks_history (settled_at desc);

-- Registro de llamadas a APIs externas: evita repetir una llamada ya cacheada.
create table if not exists public.ingest_log (
  key text primary key,          -- ej. 'fixtures:262:2026-09-27'
  fetched_at timestamptz default now(),
  payload_size int,
  note text
);

-- -----------------------------------------------------------------------------
-- 5. RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.reminder_emails enable row level security;
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.referees enable row level security;
alter table public.fixtures enable row level security;
alter table public.team_stats enable row level security;
alter table public.player_stats enable row level security;
alter table public.lineups enable row level security;
alter table public.injuries enable row level security;
alter table public.odds enable row level security;
alter table public.predictions enable row level security;
alter table public.fixture_analysis enable row level security;
alter table public.picks_history enable row level security;
alter table public.ingest_log enable row level security;

-- profiles: cada usuario lee y actualiza campos propios; admin lee/edita todo.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Un usuario no-admin no puede cambiar role/status/fechas: trigger de protección.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.status := old.status;
    new.trial_ends_at := old.trial_ends_at;
    new.paid_until := old.paid_until;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- reminder_emails: solo admin ve; escribe service_role (cron).
drop policy if exists "reminder_admin_read" on public.reminder_emails;
create policy "reminder_admin_read" on public.reminder_emails
  for select using (public.is_admin());

-- Datos públicos de lectura (la app decide qué bloquear según estado de cuenta).
-- Las tablas de datos son de solo lectura para anon/authenticated; escribe service_role.
do $$
declare t text;
begin
  foreach t in array array['leagues','teams','referees','fixtures','team_stats','player_stats','lineups','injuries','odds','predictions','fixture_analysis','picks_history']
  loop
    execute format('drop policy if exists "%s_public_read" on public.%I', t, t);
    execute format('create policy "%s_public_read" on public.%I for select using (true)', t, t);
  end loop;
end $$;

-- ingest_log: solo admin lee.
drop policy if exists "ingest_admin_read" on public.ingest_log;
create policy "ingest_admin_read" on public.ingest_log
  for select using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. SEMILLA DE LIGAS DEL MVP
-- -----------------------------------------------------------------------------
insert into public.leagues (id, name, country, season, odds_sport_key) values
  (262, 'Liga MX', 'Mexico', 2026, 'soccer_mexico_ligamx'),
  (253, 'MLS', 'USA', 2026, 'soccer_usa_mls'),
  (39,  'Premier League', 'England', 2026, 'soccer_epl'),
  (13,  'Copa Libertadores', 'World', 2026, 'soccer_conmebol_copa_libertadores'),
  (281, 'Liga 1', 'Peru', 2026, null),
  (282, 'Liga 2', 'Peru', 2026, null),
  (128, 'Liga Profesional Argentina', 'Argentina', 2026, 'soccer_argentina_primera_division')
on conflict (id) do update set odds_sport_key = excluded.odds_sport_key;
