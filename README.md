# Ventaja — Tu ventaja antes del pitazo

Sala de análisis estadístico de fútbol. Producto propio que se alquila al mercado de apuestas como herramienta de análisis. **Nunca procesa apuestas ni dinero.**

Stack: Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Auth, Postgres, RLS) · Vercel (hosting + Cron) · Resend · PWA. Motor Poisson/Dixon-Coles en TypeScript (`/lib/engine`).

## Puesta en marcha

1. **Supabase**: crea un proyecto y ejecuta `supabase/migrations/0001_init.sql` en el SQL Editor. Activa Google como proveedor OAuth (Authentication → Providers) y añade `https://<tu-dominio>/auth/callback` a las Redirect URLs.
2. **Variables**: copia `.env.example` a `.env.local` y rellena. `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` solo en local y en Vercel, nunca en el repo.
3. **Instalar y correr**:
   ```bash
   pnpm install
   pnpm seed:admin      # crea christianmirabal82@gmail.com como admin (lee ADMIN_EMAIL / ADMIN_PASSWORD)
   pnpm dev
   ```
4. **Primera carga de datos** (con las claves de API-Football y The Odds API):
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/stats     # calendario + estadísticas + jugadores
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/fixtures  # próximos 7 días + resultados
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/odds      # cuotas → predicciones + Lecturas
   ```
   O desde `/admin` con el botón **Actualizar partidos y cuotas**.
5. **Vercel**: importa el repo, define las mismas variables y despliega. `vercel.json` ya trae los crons (requieren plan Pro para frecuencias < 1 día).

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (next/core-web-vitals) |
| `pnpm test` | Vitest: motor (3 partidos de referencia), estados de cuenta, liquidación, emparejado de cuotas, agregación |
| `pnpm seed:admin` | Crea/actualiza el admin en Supabase Auth |
| `pnpm icons` | Regenera los PNG de la PWA desde el isotipo |

## Estructura

```
app/                 rutas (Jornada /, /partido/[id], /picks, /buscar, /historial, /cuenta, /activar, /admin, /login, /registro, /legal)
app/api/cron/*       jobs protegidos con CRON_SECRET (fixtures, stats, odds, predict, settle, accounts)
app/api/og/pick/[id] imagen 1080×1350 para compartir picks
components/          UI (Sello de Confianza, tarjetas, mercados colapsables, paywall, recordatorios, admin)
lib/engine/          motor: Elo, xG ponderado, Dixon-Coles, mercados, mitades, props, jugadores, ventaja/sello, combinadas, Lectura
lib/data/            ingesta (API-Football, The Odds API), agregación, predicción, liquidación, cuentas
lib/auth/            resolveStatus (fuente de verdad: fechas), viewer, middleware de acceso
supabase/migrations  esquema + RLS + trigger de perfiles (31 días de prueba)
messages/            es.json / en.json (cero texto hardcodeado)
emails/              plantillas de recordatorio (día 26, 29 y 31)
```

## Reglas de negocio implementadas

- Registro → `trial_ends_at = now() + 31 días` (trigger en `auth.users`).
- Estado calculado en servidor en cada request (`resolveStatus`): admin → ilimitado; `paid_until > now` → activa; suspendida → paywall; trial vigente → trial; si no → vencida. El middleware redirige rutas privadas a `/activar`; `/`, `/historial`, `/login`, `/legal` siguen públicas (en `/` la cuenta vencida ve todo borroso con candado).
- Últimos 5 días: modal en cada sesión nueva (>30 min sin actividad, por `last_seen_at`), banner ámbar fijo y emails vía Resend (5, 2 y 0 días antes).
- Sello: ALTA (prob ≥ 65% y ventaja ≥ 8%), MEDIA (≥ 55% y ≥ 5%), BAJA el resto. Nunca rojo.
- Picks: ventaja ≥ 5% y prob ≥ 55%. Combinadas de 2/3/4 selecciones (prob. conjunta ≥ 45/30/18%) de partidos distintos.
- La combinada de 2 selecciones se muestra como **"Conservadora"**: la palabra "segura" está prohibida en toda la UI.

## Disclaimer

Ventaja es una herramienta de análisis estadístico. No garantiza resultados ni acepta apuestas. Solo para mayores de 21 años. Juega con responsabilidad. 1-800-GAMBLER.
