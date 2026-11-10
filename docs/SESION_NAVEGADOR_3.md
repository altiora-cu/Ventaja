# Ventaja · Sesión en navegador (Chrome) nº 3 — avisos push, stake en dinero y registro de victorias

Eres Claude trabajando en Chrome con las sesiones ya abiertas del dueño de Ventaja (Frank). El código ya está fusionado en `main` del repo `altiora-cu/Ventaja`; Vercel lo despliega solo. Tu trabajo es dejar la base de datos y las variables listas, comprobar que todo funciona y entregar un informe en Markdown.

Las claves VAPID se generan con `node -e "const w=require('web-push');console.log(w.generateVAPIDKeys())"` y se rellenan en la tabla del paso 2 antes de entregar esta guía. Nunca se suben al repo.

Datos del proyecto:
- Supabase: proyecto `bogbxetlznavpxjkidvt` (plan Free) → https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt
- Vercel: proyecto `ventaja` del equipo `c-c-projects1` → https://vercel.com/c-c-projects1/ventaja · app en https://ventaja-liard.vercel.app
- Repo: https://github.com/altiora-cu/Ventaja (rama `main`)

Reglas al pegar variables en Vercel (evitan los errores que dieron la otra vez): sin comillas, sin espacios al principio ni al final, una variable por fila. Si la variable ya existe, edítala (lápiz) en vez de crear otra. Si al guardar como *Sensitive* da error, guárdala como *Plain*. Marca **Production** y **Preview**.

---

## 1. Supabase: migración 0010 (SQL Editor)

Abre https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt/sql/new, pega TODO el bloque siguiente y pulsa **Run**. Es idempotente: si sale "already exists" en algo, no pasa nada.

```sql
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
```

Comprueba con esta consulta (debe devolver 4 filas con las columnas nuevas de `profiles` y 2 tablas nuevas):

```sql
select column_name from information_schema.columns where table_name='profiles' and column_name in ('currency','default_stake','notify_kickoff','notify_results');
select table_name from information_schema.tables where table_name in ('push_subscriptions','push_log');
```

## 2. Vercel: 4 variables nuevas

En https://vercel.com/c-c-projects1/ventaja/settings/environment-variables añade (Production + Preview):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `PEGA-AQUI-LA-CLAVE-PUBLICA-VAPID` |
| `VAPID_PRIVATE_KEY` | `PEGA-AQUI-LA-CLAVE-PRIVADA-VAPID` |
| `VAPID_SUBJECT` | `mailto:TU-EMAIL` |
| `PUSH_KICKOFF_HOURS` | `24` |

`VAPID_PRIVATE_KEY` guárdala como Sensitive si te deja; si no, Plain.

## 3. Redeploy

En https://vercel.com/c-c-projects1/ventaja/deployments comprueba que el último despliegue de `main` incluye el commit "Avisos push, stake en dólares y soles, registro de victorias…". Si está en *Ready* pero se creó ANTES de que guardaras las variables, ábrelo → **Redeploy** → desmarca *Use existing Build Cache* → Redeploy. Espera a *Ready*.

## 4. Pruebas (en https://ventaja-liard.vercel.app, con la cuenta admin ya logueada)

1. `/cuenta`: deben verse dos bloques nuevos: **Stake y moneda** (Dólares/Soles, stake por defecto, dos interruptores de avisos) y **Avisos en el teléfono** con el botón **Activar avisos**.
2. Pulsa **Activar avisos** → acepta el permiso de Chrome → debe aparecer "Avisos activados en este dispositivo" y llegar una notificación de prueba "Avisos activados". Si no llega, pulsa **Enviar prueba**. Anota el resultado.
3. Cambia la moneda a **Soles** y el stake por defecto a `20`. Debe aparecer "Guardado".
4. Entra a un partido de hoy o mañana con cuotas (Jornada → ficha). En **Mercados**, marca una jugada con sello ALTA o MEDIA y otra con sello BAJA. Al marcar la BAJA debe aparecer debajo del botón "No recomendada por el modelo (sello BAJA)".
5. Toca la burbuja flotante (abajo a la derecha). Comprueba: cada jugada tiene un campo **Stake** con `S/`, la jugada BAJA lleva aviso ámbar "No recomendada", y abajo sale el recuadro ámbar "1 de 2 jugadas no son recomendadas…". Cambia el stake de una a `15` (sale del campo para guardar).
6. Abre `/mis-jugadas`: el primer indicador es **Balance** en soles, y hay un bloque **Registro de victorias** con Ganadas / Perdidas / Nulas / Racha. En **En juego** cada jugada tiene el campo Stake.
7. Si en el proyecto de Vercel hay pestaña **Cron Jobs** (Settings → Cron Jobs) con botón para ejecutar `/api/cron/daily`, ejecútalo y anota si termina en `ok: true` y qué dice el campo `push` del resultado. Si no hay botón, no hace falta: corre solo a las 09:00 UTC.

## 5. Si no se hizo en la sesión anterior (comprobar)

- Las 7 claves de la app en Vercel (Supabase URL/anon/service, Odds, football-data, Anthropic, CRON_SECRET) están todas y el último build las usó.
- SQL de Brasil con cuotas: `update leagues set odds_enabled=true where id=71; update leagues set odds_enabled=false, ai_web=true where id=253;`
- Authentication → Providers → Email → *Confirm email* en OFF mientras dure la prueba con amigos.

## 6. Informe

Entrega un archivo `VENTAJA_INFORME_SESION_3.md` con:
1. Migración 0010: ejecutada sí/no, mensajes de error si hubo.
2. Variables: cuáles quedaron en Vercel (solo nombres, nunca valores).
3. Redeploy: id/commit del despliegue Ready.
4. Resultado de cada una de las 7 pruebas del punto 4 (OK / falla + qué viste).
5. Punto 5: estado de cada ítem.
6. Lo que no pudiste hacer y por qué, y lo que queda pendiente.
