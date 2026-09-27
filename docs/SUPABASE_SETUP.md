# Ventaja · Guía paso a paso: subir el proyecto a Supabase

Tiempo estimado: 30–40 minutos. Necesitas: cuenta en supabase.com, cuenta en Google Cloud (para el login con Google) y el repo clonado.

---

## 1. Crear el proyecto

1. Entra a https://supabase.com/dashboard → **New project**.
2. Organization: la tuya. **Name:** `ventaja`. **Database password:** genera una fuerte y guárdala en tu gestor de contraseñas (no la usa la app, solo sirve para acceso directo a Postgres).
3. **Region:** `East US (North Virginia)`, la más cercana a Miami y a Vercel `iad1`.
4. Plan **Free** sirve para arrancar. El Pro ($25/mes) quita la pausa automática por inactividad, importante cuando haya clientes pagando.
5. Espera 1–2 minutos a que el proyecto quede en estado *Active*.

## 2. Ejecutar la migración (tablas, trigger, RLS)

1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abre `supabase/migrations/0001_init.sql` del repo, copia TODO el contenido y pégalo.
3. **Run** (Ctrl/Cmd + Enter). Debe terminar con `Success. No rows returned`.
4. Verifica: **Table Editor** → deben aparecer `profiles`, `leagues` (con 7 filas), `teams`, `fixtures`, `team_stats`, `player_stats`, `lineups`, `injuries`, `referees`, `odds`, `predictions`, `fixture_analysis`, `picks_history`, `reminder_emails`, `ingest_log`.
5. Verifica el trigger: **Database → Triggers** → `on_auth_user_created` sobre `auth.users`. Es el que da los 31 días de prueba a cada registro.
6. Verifica RLS: **Authentication → Policies** → todas las tablas del esquema `public` deben mostrar *RLS enabled*.

## 3. Copiar las claves

1. **Project Settings (engranaje) → API**.
2. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** (o *publishable key* en dashboards nuevos) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (o *secret key*) → `SUPABASE_SERVICE_ROLE_KEY`. Solo servidor: nunca en el cliente, nunca en el repo, nunca por WhatsApp.

## 4. Configurar Auth

### 4.1 URLs
**Authentication → URL Configuration**:
- **Site URL:** `https://ventaja.app` (mientras no tengas dominio, la URL de Vercel `https://ventaja-xxxx.vercel.app`).
- **Redirect URLs** (añade todas):
  ```
  http://localhost:3000/auth/callback
  https://ventaja.app/auth/callback
  https://*.vercel.app/auth/callback
  ```

### 4.2 Email + contraseña
**Authentication → Providers → Email**: dejar *Enabled*.
- **Confirm email:** recomendado ON en producción. Para probar rápido en local puedes ponerlo OFF y volver a activarlo antes de lanzar.
- **Minimum password length:** 8 (la app ya lo exige).

### 4.3 Google OAuth
1. Ve a https://console.cloud.google.com → crea proyecto `Ventaja`.
2. **APIs & Services → OAuth consent screen**: tipo *External*, nombre `Ventaja`, correo de soporte tuyo, dominio `ventaja.app`. Publica la app (si la dejas en *Testing* solo entran los correos que añadas como testers).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: *Web application*.
   - Authorized JavaScript origins: `https://ventaja.app` y `http://localhost:3000`.
   - Authorized redirect URIs: `https://<TU-PROJECT-REF>.supabase.co/auth/v1/callback` (el *project ref* es la parte antes de `.supabase.co` en tu Project URL).
4. Copia **Client ID** y **Client secret**.
5. En Supabase: **Authentication → Providers → Google** → *Enabled*, pega Client ID y Client secret → **Save**.

### 4.4 Enlace mágico y recuperación de contraseña
Funcionan con el proveedor Email. Opcional: **Authentication → Email Templates** para poner los textos en español. Con el plan Free, Supabase limita a unos 3 emails de auth por hora; para producción configura **SMTP personalizado** (Project Settings → Auth → SMTP) con Resend: host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = tu `RESEND_API_KEY`.

## 5. Variables de entorno en local

```bash
cp .env.example .env.local
```
Rellena `.env.local` (nunca se commitea):

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Paso 3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Paso 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | Paso 3 |
| `ADMIN_EMAIL` | `christianmirabal82@gmail.com` |
| `ADMIN_PASSWORD` | Inventa una de 12+ caracteres. Se cambia desde `/cuenta` tras el primer login |
| `CRON_SECRET` | Genera una: `openssl rand -hex 32` |
| `API_FOOTBALL_KEY` | dashboard.api-football.com → My Access |
| `ODDS_API_KEY` | the-odds-api.com → llega al email de registro |
| `RESEND_API_KEY` | resend.com → API Keys (verifica antes el dominio `ventaja.app`) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (Lecturas con Claude Haiku) |
| `NEXT_PUBLIC_WHATSAPP` | `13054574987` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` en local, `https://ventaja.app` en Vercel |

## 6. Crear el administrador

```bash
pnpm install
pnpm seed:admin
```
Salida esperada: `Usuario creado: christianmirabal82@gmail.com` y `Perfil admin listo`. Verifica en **Authentication → Users** (email confirmado) y en **Table Editor → profiles** (`role = admin`, `status = activa`, `paid_until = 2099-12-31`).

### 6b. Sin terminal: crear el admin desde el panel de Supabase
Si no vas a correr comandos en tu computadora, puedes crear el admin a mano:
1. **Authentication → Users → Add user → Create new user**: email `christianmirabal82@gmail.com`, contraseña de 12+ caracteres, marca **Auto Confirm User** → *Create user*.
2. El trigger crea el perfil solo. Ahora ve a **SQL Editor** y ejecuta:
   ```sql
   update public.profiles
   set role = 'admin', status = 'activa', paid_until = '2099-12-31', trial_ends_at = '2099-12-31'
   where email = 'christianmirabal82@gmail.com';
   ```
3. Listo: entra en la app con ese correo y verás **Admin** en el menú.

### 6c. Sin terminal: cargar datos desde la app
No hace falta `curl`. Una vez desplegado en Vercel (paso 8), entra como admin a `/admin` y pulsa **Actualizar partidos y cuotas**. Eso ejecuta calendario + cuotas + predicciones. Para la carga completa de estadísticas y jugadores, los crons lo hacen solos cada día (o dispara `/api/cron/stats` una vez desde el navegador: no funciona sin el secreto, así que ese sí requiere `curl` o esperar al cron).

## 7. Probar en local

```bash
pnpm dev
```
1. Abre http://localhost:3000/login y entra con el admin. Debes ver el avatar arriba a la derecha y el enlace **Admin**.
2. Regístrate con otro correo en `/registro`. En **profiles** debe aparecer con `trial_ends_at` = hoy + 31 días.
3. Carga datos (con las claves de API-Football y Odds API puestas):
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/stats
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/fixtures
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/odds
   ```
   La Jornada debe mostrar partidos con probabilidades y Sellos.

## 8. Subir a Vercel

1. vercel.com → **Add New → Project** → importa `altiora-cu/Ventaja`. Framework: Next.js (auto). Build command por defecto.
2. **Environment Variables**: pega las mismas del paso 5 con `NEXT_PUBLIC_APP_URL=https://ventaja.app`. Marca `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `CRON_SECRET` y las API keys como *Sensitive*.
3. Deploy. Vercel lee `vercel.json` y programa los 6 crons; Vercel envía automáticamente `Authorization: Bearer $CRON_SECRET` a cada uno. Los crons con frecuencia menor a 1 día requieren plan **Pro** de Vercel ($20/mes).
4. **Settings → Domains** → añade `ventaja.app` y apunta el DNS según indique Vercel.
5. Vuelve a Supabase → **URL Configuration** y confirma que el dominio final está en *Site URL* y *Redirect URLs*.

## 9. Checklist final antes de lanzar

- [ ] Confirm email ON.
- [ ] SMTP personalizado con Resend configurado (o aceptar el límite del Free).
- [ ] Google OAuth publicado (no en *Testing*).
- [ ] `ADMIN_PASSWORD` cambiada desde `/cuenta`.
- [ ] `curl https://ventaja.app/api/cron/accounts` sin header → responde 401.
- [ ] `/historial` abre sin login; `/picks` sin login redirige a `/login`.
- [ ] Un usuario nuevo ve "Prueba gratis · quedan 31 días" en `/cuenta`.
- [ ] Backups: Supabase Pro los hace diarios; en Free, exporta con `pg_dump` semanalmente.

## Planes de datos: qué se puede hacer gratis y qué no

| Servicio | Plan gratis | Sirve para Ventaja |
|---|---|---|
| API-Football | 100 llamadas/día y solo temporadas anteriores | **Opcional.** Desde la migración 0003 la app funciona sin API-Football: calendario, cuotas y resultados salen de The Odds API y la Premier completa de football-data.org. Si más adelante contratas el plan de pago, pon `DATA_SOURCE=api_football` y recuperas corners, tarjetas, tiros, xG, jugadores y lesiones. |
| football-data.org | Gratis, 10 llamadas/min | **Sí.** Temporada completa de la Premier (descanso y árbitro incluidos). Registro en football-data.org/client/register → clave por email → `FOOTBALL_DATA_KEY`. |
| The Odds API | 500 créditos/mes | **Sí** en modo económico: `ODDS_REGIONS=us`, `ODDS_MARKETS=h2h,totals`, `ODDS_EXTRA_MARKETS=false`, `ODDS_TTL_HOURS=24`. Calendario gratis; cuotas 2 créditos por liga y día; resultados 2 créditos por liga solo los días con partidos. Estimación: 250–300 créditos/mes para 5 ligas. `ODDS_MIN_CREDITS=50` reserva créditos para resultados. Liga 1 y Liga 2 de Perú quedan desactivadas (sin cobertura). |
| Supabase | Free | Sí, hasta tener clientes pagando (pausa por inactividad). |
| Vercel | Hobby | Sí para desplegar; los crons de menos de 1 día requieren Pro. Alternativa gratis: el botón de `/admin` una vez al día. |
| Resend | Free | Sí (3.000 emails/mes). |
| Anthropic | Pago por uso | Lecturas con Claude Haiku: < 2 USD/mes. Sin clave, la app usa la Lectura de respaldo (texto generado por reglas). |

**Por qué no "buscar en Google" en lugar de pagar API-Football:** el modelo necesita datos estructurados y consistentes (xG, corners, tarjetas, alineaciones) partido a partido para que el Historial público sea verificable. Extraer eso de páginas web rompe cada vez que cambian el diseño, viola términos de uso de varios sitios y no se puede auditar. Una IA generativa sin esos datos "adivina" y la ventaja desaparece. La IA en Ventaja aporta valor encima de los datos (Lectura, contexto, alertas), no en lugar de ellos.

## Costos mensuales estimados

| Servicio | Plan | USD/mes |
|---|---|---|
| Supabase | Free → Pro cuando haya clientes | 0 → 25 |
| Vercel | Pro (crons cada 2–6 h) | 20 |
| API-Football | Pro | ~39 |
| The Odds API | 20k requests | ~59 |
| Resend | Free (3k emails) | 0 |
| Anthropic (Lecturas) | Pago por uso | < 2 |
| **Total** | | **~120–145** |
