-- =============================================================================
-- VENTAJA · Migración 10: avisos push, stake en dinero (USD / PEN) y registro de victorias
-- - profiles: moneda, stake por defecto y preferencias de aviso.
-- - user_picks / user_combos: stake (dinero apostado) fijado al marcar; editable antes del pitazo.
-- - push_subscriptions: suscripciones Web Push de cada usuario (varios dispositivos).
-- - push_log: avisos ya enviados, para no repetirlos.
-- Idempotente: se puede ejecutar más de una vez.
-- =============================================================================

alter table public.profiles add column if not exists currency text not null default 'USD';
alter table public.profiles add column if not exists default_stake numeric not null default 10;
alter table public.profiles add column if not exists notify_kickoff boolean not null default true;
alter table public.profiles add column if not exists notify_results boolean not null default true;

do $$ begin
  alter table public.profiles add constraint profiles_currency_check check (currency in ('USD','PEN'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_default_stake_check check (default_stake > 0 and default_stake <= 100000);
exception when duplicate_object then null; end $$;

alter table public.user_picks add column if not exists stake numeric;
alter table public.user_combos add column if not exists stake numeric;
do $$ begin
  alter table public.user_picks add constraint user_picks_stake_check check (stake is null or (stake > 0 and stake <= 100000));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.user_combos add constraint user_combos_stake_check check (stake is null or (stake > 0 and stake <= 100000));
exception when duplicate_object then null; end $$;

-- El trigger de protección del perfil sigue igual: moneda, stake y avisos sí los cambia el usuario.

-- -----------------------------------------------------------------------------
-- Suscripciones Web Push. Cada fila es un navegador/dispositivo.
-- -----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_used_at timestamptz,
  failures int not null default 0
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id or public.is_admin());
-- Escrituras solo desde las acciones de servidor (service_role).
revoke insert, update, delete on public.push_subscriptions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Registro de avisos enviados: una fila por usuario y clave (kickoff:<pick>, result:pick:<id>, ...).
-- -----------------------------------------------------------------------------
create table if not exists public.push_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  sent_at timestamptz default now(),
  unique (user_id, key)
);
alter table public.push_log enable row level security;
drop policy if exists "push_log_admin_read" on public.push_log;
create policy "push_log_admin_read" on public.push_log
  for select using (public.is_admin());
revoke insert, update, delete on public.push_log from anon, authenticated;
