# Ventaja · Runbook de terminal (copiar y pegar)

Objetivo: dejar Supabase migrado, el admin creado, los datos cargados y la app desplegada en Vercel **solo con comandos de terminal**. Hecho para que lo ejecute una persona o un asistente de terminal (Claude Code local) sin decisiones adicionales.

Requisitos en la máquina: Node 20+, `pnpm` (`npm i -g pnpm`), `git`, `curl`. macOS o Linux. En Windows usar WSL.

Antes de empezar ten a mano (no las pegues en ningún chat):
- Supabase: **Project URL**, **publishable/anon key**, **secret/service_role key** y el **project ref** (la parte antes de `.supabase.co`). También la contraseña de la base de datos que elegiste al crear el proyecto.
- API-Football key (plan de pago; el gratis no cubre la temporada actual).
- The Odds API key.
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
API_FOOTBALL_KEY=XXXX
ODDS_API_KEY=XXXX
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
SECRET=$(openssl rand -hex 32) && sed -i.bak "s/^CRON_SECRET=.*/CRON_SECRET=$SECRET/" .env.local && rm .env.local.bak && grep CRON_SECRET .env.local
```

## 2. Migrar la base de datos con el CLI de Supabase

```bash
npm i -g supabase
supabase login                      # abre el navegador y pega el token
supabase link --project-ref TU-PROJECT-REF   # pide la contraseña de la base de datos
supabase db push                    # aplica supabase/migrations/0001_init.sql y 0002_ai_review.sql
```

Verificación (debe listar 7 ligas):

```bash
set -a; source .env.local; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/leagues?select=id,name,season" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Si `supabase db push` falla por versión del CLI, alternativa: abre el SQL Editor del panel de Supabase y pega el contenido de `supabase/migrations/0001_init.sql` y luego el de `0002_ai_review.sql`.

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
Tarda 2–6 minutos la primera vez (descarga calendario, estadísticas de partidos terminados y jugadores de las 7 ligas). Al final imprime, por liga, cuántos partidos de los próximos 7 días tienen cuotas y predicción. Si una liga con cobertura muestra "sin cuotas", copia esa lista y pásala al desarrollador: son nombres de equipo que no emparejaron.

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

`vercel.json` ya programa los 6 crons. Vercel les envía `Authorization: Bearer $CRON_SECRET` automáticamente. Con plan Hobby solo corren los diarios; los de 2–6 h requieren Pro. Sin Pro, dispara la actualización una vez al día con:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/odds
```
(`odds` encadena cuotas → alineaciones → predicciones → Lecturas y Revisión IA.)

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
