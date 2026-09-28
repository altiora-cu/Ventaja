-- =============================================================================
-- VENTAJA · Migración 5: jugadas del usuario y registro de combinadas
-- - system_combos: combinadas que propone el sistema cada día, con su resultado.
-- - user_picks / user_combos: jugadas y combinadas que el usuario marca.
-- Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper para RLS: ¿el usuario autenticado tiene acceso vigente?
--    Misma regla que resolveStatus() en lib/auth/status.ts (fuente de verdad: las fechas).
-- -----------------------------------------------------------------------------
create or replace function public.has_access()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or p.paid_until > now()
        or (p.status <> 'suspendida' and p.trial_ends_at > now())
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. Combinadas del sistema. Cerradas: registro público, como picks_history. En juego: solo con acceso.
-- -----------------------------------------------------------------------------
create table if not exists public.system_combos (
  id bigserial primary key,
  date_key date not null,            -- día de la jornada (zona horaria de la app)
  kind text not null check (kind in ('segura','equilibrada','ambiciosa')),
  selections jsonb not null,         -- [{fixture_id, market, selection, line, player_id, player_name, prob, price, sello, home, away, league, kickoff, result}]
  joint_prob numeric not null,
  total_price numeric not null,
  result text check (result in ('acierto','fallo','nulo')),  -- null = pendiente
  units numeric not null default 0,
  created_at timestamptz default now(),
  settled_at timestamptz,
  unique (date_key, kind)
);
create index if not exists system_combos_date_idx on public.system_combos (date_key desc);

alter table public.system_combos enable row level security;
drop policy if exists "system_combos_public_read" on public.system_combos;
drop policy if exists "system_combos_read" on public.system_combos;
create policy "system_combos_read" on public.system_combos
  for select using (result is not null or public.has_access());

-- -----------------------------------------------------------------------------
-- 2. Combinadas del usuario
-- -----------------------------------------------------------------------------
create table if not exists public.user_combos (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'propia' check (kind in ('propia','segura','equilibrada','ambiciosa')),
  joint_prob numeric not null,
  total_price numeric,
  result text check (result in ('acierto','fallo','nulo')),  -- null = pendiente
  units numeric not null default 0,
  created_at timestamptz default now(),
  settled_at timestamptz
);
create index if not exists user_combos_user_idx on public.user_combos (user_id, created_at desc);
create index if not exists user_combos_pending_idx on public.user_combos (id) where result is null;

-- -----------------------------------------------------------------------------
-- 3. Jugadas del usuario (sueltas, o selecciones de una combinada si combo_id no es null)
-- -----------------------------------------------------------------------------
create table if not exists public.user_picks (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  combo_id bigint references public.user_combos(id) on delete cascade,
  fixture_id int not null references public.fixtures(id) on delete cascade,
  market text not null,
  selection text not null,
  line numeric,
  player_id int,
  player_name text,
  prob numeric not null,             -- probabilidad del modelo al marcar
  price numeric,                     -- mejor cuota al marcar
  sello text not null check (sello in ('alta','media','baja')),
  result text check (result in ('acierto','fallo','nulo')),  -- null = pendiente
  units numeric not null default 0,
  created_at timestamptz default now(),
  settled_at timestamptz
);
create index if not exists user_picks_user_idx on public.user_picks (user_id, created_at desc);
create index if not exists user_picks_fixture_idx on public.user_picks (fixture_id);
create index if not exists user_picks_combo_idx on public.user_picks (combo_id) where combo_id is not null;
create index if not exists user_picks_pending_idx on public.user_picks (fixture_id) where result is null;
-- Una misma jugada suelta no se marca dos veces.
create unique index if not exists user_picks_single_uidx
  on public.user_picks (user_id, fixture_id, market, selection, coalesce(line, -999), coalesce(player_id, 0))
  where combo_id is null;

-- -----------------------------------------------------------------------------
-- 4. RLS: cada usuario solo LEE lo suyo.
--    No hay políticas de insert, update ni delete: las escrituras pasan por las acciones de
--    servidor (app/actions/jugadas.ts), que validan sesión, acceso, que el partido no haya
--    empezado y que probabilidad y cuota salgan de la tabla predictions, y escriben con
--    service_role. Así nadie puede falsear una cuota, marcar un partido ya jugado ni borrar
--    una jugada que va perdiendo llamando a la API directamente.
-- -----------------------------------------------------------------------------
alter table public.user_combos enable row level security;
alter table public.user_picks enable row level security;

drop policy if exists "user_combos_select_own" on public.user_combos;
create policy "user_combos_select_own" on public.user_combos
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "user_picks_select_own" on public.user_picks;
create policy "user_picks_select_own" on public.user_picks
  for select using (auth.uid() = user_id or public.is_admin());

-- Políticas de un borrador anterior de esta migración: se retiran si llegaron a crearse.
drop policy if exists "user_combos_insert_own" on public.user_combos;
drop policy if exists "user_combos_delete_pending" on public.user_combos;
drop policy if exists "user_picks_insert_own" on public.user_picks;
drop policy if exists "user_picks_delete_pending" on public.user_picks;

revoke insert, update, delete on public.user_combos, public.user_picks, public.system_combos from anon, authenticated;
