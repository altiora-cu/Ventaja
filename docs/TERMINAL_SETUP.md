# Ventaja · Runbook de terminal (copiar y pegar)

Objetivo: dejar Supabase migrado, el admin creado, los datos cargados y la app desplegada en Vercel **solo con comandos de terminal**. Hecho para que lo ejecute una persona o un asistente de terminal (Claude Code local) sin decisiones adicionales.

Requisitos en la máquina: Node 20+, `pnpm` (`npm i -g pnpm`), `git`, `curl`. macOS, Linux o **Windows con Git Bash** (no PowerShell ni cmd: los comandos son de bash).

Antes de empezar ten a mano (no las pegues en ningún chat):
- Supabase: **Project URL**, **publishable/anon key**, **secret/service_role key** y el **project ref** (la parte antes de `.supabase.co`). También la contraseña de la base de datos que elegiste al crear el proyecto.
- The Odds API key (plan gratis de 500 créditos/mes sirve para empezar).
- football-data.org key (gratis, registro en https://www.football-data.org/client/register): temporada completa de la Premier.
- API-Football key solo si contratas el plan de pago (opcional).
- Anthropic API key (opcional, para Lecturas y Revisión IA).
- Resend API key (opcional, para emails de recordatorio).

---

## 0. Clonar e instalar

```bash
git clone https://github.com/altiora-cu/Ventaja.git
cd Ventaja
pnpm install
```

## 1. Variables de entorno

Crea `.env.local` rellenando cada valor. El archivo está en `.gitignore`: nunca se sube al repo.

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_XXXX
SUPABASE_SERVICE_ROLE_KEY=sb_secret_XXXX
ODDS_API_KEY=XXXX
FOOTBALL_DATA_KEY=XXXX
API_FOOTBALL_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
RESEND_FROM=Ventaja <hola@ventaja.app>
ADMIN_EMAIL=christianmirabal82@gmail.com
ADMIN_PASSWORD=CAMBIA-ESTO-12-CARACTERES-MINIMO
CRON_SECRET=
NEXT_PUBLIC_WHATSAPP=13054574987
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Modo económico de cuotas (plan gratis de The Odds API, 500 créditos/mes)
ODDS_REGIONS=us
ODDS_MARKETS=h2h,totals
ODDS_EXTRA_MARKETS=false
ODDS_TTL_HOURS=24
EOF
```

Genera el secreto de los crons y guárdalo en el archivo:

```bash
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") && sed -i.bak "s/^CRON_SECRET=.*/CRON_SECRET=$SECRET/" .env.local && rm .env.local.bak && grep CRON_SECRET .env.local
```
(Se usa Node en vez de `openssl` porque en Windows no siempre está disponible.)

## 2. Migrar la base de datos con el CLI de Supabase

```bash
npx supabase login                      # abre el navegador y pega el token
npx supabase link --project-ref TU-PROJECT-REF   # pide la contraseña de la base de datos
npx supabase db push                    # aplica supabase/migrations/0001, 0002 y 0003
```
(Supabase no soporta `npm i -g supabase`; se usa `npx`.)

Si las migraciones 0001 y 0002 ya se aplicaron a mano por el SQL Editor, márcalas como aplicadas antes del push para que solo entre la 0003:

```bash
npx supabase migration repair --status applied 0001 0002
npx supabase db push
```

Verificación (debe listar 7 ligas):

```bash
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-); KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)
curl -s "$URL/rest/v1/leagues?select=id,name,season,active" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Tras la migración 0003, Liga 1 y Liga 2 de Perú aparecen con `active: false` (ningún proveedor gratuito las cubre).

Si `supabase db push` falla, alternativa: abre el SQL Editor del panel de Supabase y pega, en orden, `0001_init.sql`, `0002_ai_review.sql` y `0003_providers.sql`.

## 3. Configurar Auth (una sola vez, en el panel)

Esto no tiene comando; son 3 pantallas:
1. **Authentication → URL Configuration**: Site URL `http://localhost:3000` (luego el dominio final). Redirect URLs: `http://localhost:3000/auth/callback`, `https://*.vercel.app/auth/callback`, `https://ventaja.app/auth/callback`.
2. **Authentication → Providers → Email**: activado. *Confirm email* ON en producción.
3. **Authentication → Providers → Google**: pega Client ID y Secret de Google Cloud (redirect URI en Google: `https://TU-PROJECT-REF.supabase.co/auth/v1/callback`).

## 4. Crear el admin

```bash
pnpm seed:admin
```
Salida esperada: `Usuario creado: christianmirabal82@gmail.com` y `Perfil admin listo`.

## 5. Primera ingesta y diagnóstico

```bash
pnpm ingest:check
```
Tarda 1–3 minutos. Descarga el calendario (0 créditos de The Odds API), la temporada completa de la Premier (football-data.org), resultados recientes (2 créditos por liga, solo si hay partidos sin marcador), cuotas (2 créditos por liga en modo económico) y calcula predicciones. Al final imprime, por liga, cuántos partidos de los próximos 7 días tienen cuotas y predicción, los partidos por fuente y los créditos restantes. Con los scripts ya cargando `.env.local`, no hace falta `DOTENV_CONFIG_PATH`; `ingest:check` usa `cross-env`, así que funciona también desde Git Bash en Windows.

**Arranque en frío:** las ligas que salen de The Odds API empiezan sin historial (los resultados solo se pueden pedir 3 días atrás). Hasta que cada equipo acumule 5 partidos, la app marca "Muestra pequeña" y mezcla la probabilidad del modelo con la cuota del mercado, así que los sellos serán BAJA. Es lo esperado; a las 3–4 semanas el modelo trabaja solo. La Premier no tiene este problema.

Para repetir solo el reporte sin volver a llamar a las APIs:

```bash
pnpm ingest:check --skip-run
```

## 6. Probar en local

```bash
pnpm dev
```
Abre http://localhost:3000/login, entra con `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Debes ver la Jornada con partidos, sellos y el enlace **Admin**. Cambia la contraseña desde `/cuenta`.

## 7. Desplegar en Vercel por terminal

```bash
npm i -g vercel
vercel login
vercel link          # crea el proyecto (acepta los valores por defecto; framework Next.js se detecta solo)
```

Sube las variables a producción (lee `.env.local` y las añade una por una; `NEXT_PUBLIC_APP_URL` se corrige después):

```bash
while IFS='=' read -r k v; do
  [[ -z "$k" || "$k" == \#* ]] && continue
  printf '%s' "$v" | vercel env add "$k" production --force >/dev/null && echo "✓ $k"
done < .env.local
printf '%s' "https://ventaja.app" | vercel env add NEXT_PUBLIC_APP_URL production --force
vercel --prod
```

`vercel.json` programa **un solo cron diario** (`/api/cron/daily`, 09:00 UTC = 05:00 ET), compatible con el plan Hobby. Encadena calendario y resultados → estadísticas → cuotas → predicciones, Lecturas y Revisión IA → cierre de picks → cuentas y recordatorios. Vercel le envía `Authorization: Bearer $CRON_SECRET` automáticamente. Si pasas a plan Pro, renombra `vercel.pro.json` a `vercel.json` para tener crons cada 2–6 h. Para forzar una actualización a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/daily
```

## 8. Dominio y URLs finales

```bash
vercel domains add ventaja.app
```
Sigue las instrucciones de DNS que imprime. Luego en Supabase → URL Configuration pon `https://ventaja.app` como Site URL.

## 9. Comprobaciones finales

```bash
D=https://ventaja.app
curl -s -o /dev/null -w "cron sin secreto → %{http_code} (esperado 401)\n" $D/api/cron/accounts
curl -s -o /dev/null -w "historial público → %{http_code} (esperado 200)\n" $D/historial
curl -s -o /dev/null -w "picks sin login → %{http_code} (esperado 307 a /login)\n" $D/picks
```

Listo. A partir de aquí, la operación diaria es: los crons cargan datos, cierran picks y envían recordatorios; tú activas cuentas desde `/admin` cuando alguien paga por WhatsApp.
