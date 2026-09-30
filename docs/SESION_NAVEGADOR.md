# Ventaja · Instrucciones para la sesión de Claude en el navegador

Este documento se le entrega tal cual a una sesión de Claude que controla el navegador del dueño (Claude en Chrome o el navegador integrado de la app de escritorio). Fecha: 30 de septiembre de 2026. Repositorio: `altiora-cu/Ventaja`, rama `main`. Proyecto Vercel: `c-c-projects1/ventaja`. Proyecto Supabase: `bogbxetlznavpxjkidvt`.

## 0. Reglas para la sesión

1. **Nunca escribas claves, contraseñas ni tokens en el chat ni en el informe.** Lee los valores de la pantalla del dueño o de su gestor de contraseñas y pégalos directamente en el campo de destino. En el informe escribe solo "cargada" o "falta".
2. Antes de cada acción que cambie algo (guardar variable, redeploy, añadir dominio, ejecutar SQL, revocar clave), di en una línea qué vas a hacer y espera la confirmación del dueño.
3. No cambies nada en el repositorio de GitHub. Esta sesión solo toca paneles (Vercel, Supabase, Anthropic, Resend, DNS) y prueba la app en el navegador.
4. Si un paso no se puede completar, anótalo en el informe con el motivo exacto (texto del error, pantalla) y sigue con el siguiente.
5. Al terminar, entrega el informe con la plantilla de la sección 9, en Markdown, listo para pegar.

## 1. Vercel: variables de entorno

Abre https://vercel.com/c-c-projects1/ventaja/settings/environment-variables.

Para cada variable de la tabla: si no existe, pulsa *Add*, escribe la *Key*, pega el *Value*, marca *Production* (y *Preview*), marca *Sensitive* donde se indica, y guarda. Si existe, comprueba que el valor no esté vacío.

| Key | Valor | Sensitive | De dónde sale |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bogbxetlznavpxjkidvt.supabase.co` | no | Fijo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave `sb_publishable_…` | no | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | clave `sb_secret_…` | **sí** | Supabase → API Keys → Secret keys. Nunca con prefijo `NEXT_PUBLIC` |
| `NEXT_PUBLIC_APP_URL` | `https://ventaja.app` (o la URL `*.vercel.app` hasta tener dominio) | no | Fijo |
| `CRON_SECRET` | 64 caracteres hexadecimales nuevos | **sí** | Generar en https://www.random.org/strings/?num=1&len=64&digits=on&loweralpha=on&unique=on&format=plain o pedir al dueño |
| `ODDS_API_KEY` | clave de The Odds API | **sí** | Dueño |
| `FOOTBALL_DATA_KEY` | clave de football-data.org | **sí** | Dueño |
| `ANTHROPIC_API_KEY` | clave `sk-ant-…` | **sí** | console.anthropic.com → API Keys (ver sección 4) |
| `RESEND_API_KEY` | clave `re_…` | **sí** | resend.com → API Keys (ver sección 6) |
| `RESEND_FROM` | `Ventaja <hola@ventaja.app>` | no | Fijo (dominio verificado en Resend) |
| `NEXT_PUBLIC_WHATSAPP` | `13054574987` | no | Fijo |
| `ODDS_REGIONS` | `us` | no | Modo económico |
| `ODDS_MARKETS` | `h2h,totals` | no | Modo económico |
| `ODDS_EXTRA_MARKETS` | `false` | no | Modo económico |
| `ODDS_TTL_HOURS` | `24` | no | Modo económico |
| `ODDS_MIN_CREDITS` | `50` | no | Reserva para resultados |
| `AI_REVIEW_MAX` | `40` | no | Tope de revisiones IA por corrida |
| `AI_WEB_MAX` | `15` | no | Tope de análisis con búsqueda web por corrida |

**No cargar:** `ADMIN_EMAIL`, `ADMIN_PASSWORD` (solo sirven al script local), `API_FOOTBALL_KEY`, `DATA_SOURCE`.

Verificación: la lista debe mostrar las 18 variables de la tabla. Anota en el informe cuáles quedaron cargadas y cuáles faltan.

## 2. Vercel: despliegue

1. https://vercel.com/c-c-projects1/ventaja/settings/git → confirma que *Production Branch* es `main`.
2. https://vercel.com/c-c-projects1/ventaja/settings/general → *Node.js Version* 20.x o 22.x; *Framework Preset* Next.js; *Install Command* por defecto (Vercel detecta pnpm por `pnpm-lock.yaml`).
3. https://vercel.com/c-c-projects1/ventaja/deployments → abre el último despliegue. Si está en *Error*, copia las últimas 40 líneas del log al informe. Si está *Ready* pero es anterior a las variables cargadas, pulsa *⋯ → Redeploy* (sin marcar "use existing build cache").
4. Espera el estado *Ready* y copia la URL de producción (`https://ventaja-….vercel.app`) al informe.
5. Plan: en https://vercel.com/c-c-projects1/settings/billing anota si es Hobby o Pro. Hobby no permite uso comercial; el dueño decide cuándo pasar a Pro. Con Hobby el único cron es `/api/cron/daily` a las 09:00 UTC.

## 3. Vercel: dominio

1. https://vercel.com/c-c-projects1/ventaja/settings/domains → *Add* → `ventaja.app` → *Add*. Añade también `www.ventaja.app` y márcalo para redirigir a `ventaja.app`.
2. Vercel muestra los registros DNS necesarios (normalmente un `A` a `76.76.21.21` para el apex y un `CNAME` a `cname.vercel-dns.com` para `www`). Cópialos al informe.
3. Abre el panel del registrador del dominio (pregunta al dueño cuál es: Namecheap, GoDaddy, Cloudflare…) y crea esos registros. Si es Cloudflare, deja el proxy en *DNS only* (nube gris) al menos hasta que Vercel marque el dominio como válido.
4. Vuelve a Vercel → Domains: espera a que aparezca *Valid Configuration*. Puede tardar de minutos a horas. Anota el estado.
5. Si el dueño aún no ha comprado `ventaja.app`, anótalo como pendiente y usa la URL `*.vercel.app` en todo lo demás.

## 4. Anthropic: clave y límite de gasto

1. https://console.anthropic.com/settings/keys → si la clave usada hasta ahora se compartió por chat, pulsa *Revoke* sobre ella y crea una nueva (*Create Key*, nombre `ventaja-prod`). Pega la nueva en Vercel (sección 1) y guarda.
2. https://console.anthropic.com/settings/limits → pon un límite de gasto mensual de **15 USD** (Lecturas, Revisión IA y análisis con búsqueda web para unos 30 partidos al día caben de sobra).
3. https://console.anthropic.com/settings/billing → confirma que hay saldo (mínimo 5 USD).
4. Anota en el informe: clave rotada sí/no, límite puesto, saldo aproximado.

## 5. Supabase: Auth, SQL y claves

1. https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt/auth/url-configuration → *Site URL* `https://ventaja.app` (o la URL de Vercel). *Redirect URLs*: añade `https://ventaja.app/auth/callback`, `https://www.ventaja.app/auth/callback`, `https://*.vercel.app/auth/callback` y `http://localhost:3000/auth/callback`. Guarda.
2. https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt/auth/providers → *Email* activado con *Confirm email* ON. *Google*: si no está configurado, anótalo como pendiente (necesita Client ID y Secret de Google Cloud; instrucciones en `docs/SUPABASE_SETUP.md`, sección 4.3).
3. https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt/sql/new → ejecuta, una por una, las migraciones **0008** y **0009** copiando el contenido de estos archivos de GitHub:
   - https://github.com/altiora-cu/Ventaja/blob/main/supabase/migrations/0008_odds_enabled.sql
   - https://github.com/altiora-cu/Ventaja/blob/main/supabase/migrations/0009_ai_web.sql
   Pulsa *Raw* en GitHub para copiar el texto limpio. Cada una debe terminar en *Success*.
4. Verifica con esta consulta y copia el resultado al informe:
   ```sql
   select id, name, active, odds_enabled, ai_web, fd_code from public.leagues order by odds_enabled desc, ai_web desc, id;
   ```
   Esperado: 5 ligas con `odds_enabled = true` (39, 262, 253, 13, 128); el resto de las activas con `ai_web = true`; Perú (281, 282) inactivas.
5. Prioridad del dueño (Brasil, Perú, Argentina, Europa, Libertadores, competiciones europeas): si el dueño quiere que Argentina o Brasil tengan cuotas en vez de MLS o Liga MX, ejecuta el cambio que él indique, por ejemplo:
   ```sql
   update public.leagues set odds_enabled = false, ai_web = true where id in (253, 262);  -- MLS y Liga MX pasan a IA web
   update public.leagues set odds_enabled = true,  ai_web = false where id in (71, 128);  -- Brasil A y Argentina reciben cuotas
   ```
   Regla: no más de 5 ligas con `odds_enabled = true` mientras The Odds API esté en plan gratis. Perú no tiene calendario en ningún proveedor gratuito: déjala inactiva y anótalo.
6. https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt/settings/api-keys → si la clave *secret* se compartió por chat, genera una nueva, pégala en Vercel y borra la anterior. Anótalo.
7. SMTP (recomendado antes de abrir al público): Project Settings → Auth → *SMTP Settings* → activar, host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la clave de Resend, remitente `hola@ventaja.app`. Requiere la sección 6 hecha.

## 6. Resend: dominio y clave

1. https://resend.com/domains → *Add Domain* → `ventaja.app` → copia los registros DNS (SPF, DKIM, DMARC) al registrador del dominio → vuelve y pulsa *Verify*. Anota el estado.
2. https://resend.com/api-keys → *Create API Key* → nombre `ventaja-prod`, permiso *Sending access* → pega en Vercel como `RESEND_API_KEY`.
3. Si el dominio no está verificado, los recordatorios no saldrán: anótalo como pendiente.

## 7. Claves expuestas: rotación

Las siguientes claves se compartieron por chat y deben regenerarse en su panel, actualizarse en Vercel y, si el dueño tiene el proyecto en local, en su `.env.local`:

| Clave | Dónde se regenera |
|---|---|
| Supabase secret | Supabase → Project Settings → API Keys |
| The Odds API | Correo de registro en the-odds-api.com (pedir nueva clave) |
| football-data.org | https://www.football-data.org/client/home → *Reset token* |
| API-Football | dashboard.api-football.com → My Access (opcional, ya no se usa) |
| Anthropic | Sección 4 |

Anota cuáles se rotaron.

## 8. Prueba de humo en producción

Con el despliegue *Ready* y las variables cargadas, abre en el navegador (sustituye `DOMINIO` por el dominio o la URL de Vercel):

| Paso | URL | Esperado |
|---|---|---|
| 1 | `https://DOMINIO/historial` | Carga sin sesión, con el aviso de contenido bloqueado si hay picks en juego |
| 2 | `https://DOMINIO/` | Jornada con partidos; tarjetas con candado sin sesión |
| 3 | `https://DOMINIO/registro` | Formulario con casilla de 21+; registra un correo de prueba del dueño; llega correo de confirmación (si Confirm email está ON) |
| 4 | `https://DOMINIO/login` | Entrar como administrador (credenciales del dueño, nunca en el chat) |
| 5 | `https://DOMINIO/admin` | Panel con contadores, botones y tabla de usuarios. Pulsa **Actualizar partidos y cuotas** y espera el mensaje de resultado (puede tardar 1 a 4 minutos). Copia el mensaje |
| 6 | `https://DOMINIO/` como admin | Partidos con probabilidades y sellos; en ligas sin cuotas, etiqueta "IA web" en algunas tarjetas |
| 7 | Abrir un partido con "IA web" | Tarjeta "Análisis IA con búsqueda web" con jugada, estimación, resumen y fuentes |
| 8 | Abrir un partido con cuotas | Lectura, marcador probable, mercados con cuota y ventaja, tarjeta "Revisión IA" |
| 9 | `https://DOMINIO/picks` | Sencillas y combinadas (o el mensaje de que hoy no hay selecciones) |
| 10 | `https://DOMINIO/cuenta` | Estado "Administrador"; cambiar la contraseña del admin (el dueño la teclea) |
| 11 | `https://DOMINIO/api/cron/daily` | Responde `{"error":"No autorizado"}` con código 401 |
| 12 | `https://DOMINIO/opengraph-image` | Se ve la imagen 1200×630 con el wordmark |
| 13 | `https://DOMINIO/manifest.webmanifest` | JSON con nombre Ventaja e íconos |
| 14 | Móvil: reduce la ventana a 375 px de ancho o usa las herramientas de desarrollador | Barra inferior de 4 ítems, sin scroll horizontal, disclaimer visible |

Para cada paso anota "OK" o el error visto (texto y captura si es posible).

Cron a mano (opcional, si el dueño te da el `CRON_SECRET`): no se puede hacer desde el navegador con cabeceras; pide al dueño que lo ejecute en su terminal:
```bash
curl -H "Authorization: Bearer CRON_SECRET" https://DOMINIO/api/cron/daily
```
y pega la respuesta completa en el informe.

## 9. Plantilla del informe (entregar en Markdown)

```markdown
# Ventaja · Informe de la sesión en navegador
Fecha y hora: …  ·  Ejecutado por: Claude (navegador)  ·  Dueño presente: sí/no

## 1. Resumen en 5 líneas
- Estado del despliegue: Ready / Error / no desplegado
- URL de producción: …
- Dominio: válido / pendiente DNS / no comprado
- Variables cargadas: N de 18
- Prueba de humo: N de 14 pasos OK

## 2. Variables de entorno en Vercel
| Key | Estado (cargada / falta / vacía) | Nota |
|---|---|---|
| … | … | … |

## 3. Despliegue
- Rama de producción: …
- Último despliegue: fecha, estado, duración
- Errores del build (si los hay, últimas 40 líneas):
```
…
```

## 4. Dominio y DNS
- Registros creados: …
- Estado en Vercel: …
- Resend: dominio verificado sí/no

## 5. Supabase
- URL Configuration: Site URL … · Redirect URLs …
- Proveedores: Email (Confirm email on/off) · Google (configurado/pendiente)
- Migraciones ejecutadas: 0008 …, 0009 …
- Resultado de la consulta de ligas:
```
…
```
- SMTP: configurado sí/no

## 6. Anthropic
- Clave rotada: sí/no · Límite mensual: … USD · Saldo aprox.: … USD

## 7. Claves rotadas
| Clave | Rotada | Actualizada en Vercel |
|---|---|---|

## 8. Prueba de humo
| Paso | Resultado | Detalle |
|---|---|---|
| 1 | OK / ERROR | … |
| … | | |
- Mensaje del botón "Actualizar partidos y cuotas": …
- Respuesta del cron (si se ejecutó): …

## 9. Lo que hice
- …

## 10. Lo que no pude hacer y por qué
- …

## 11. Lo que falta para abrir al mercado (en orden)
1. …
2. …

## 12. Decisiones que necesita tomar el dueño
- …
```

## 10. Qué hacer con el informe

El dueño lo pega en la sesión de Claude Code (repositorio) para que revise lo hecho, corrija lo que falló y planifique lo que resta. No adjuntes capturas que muestren claves.
