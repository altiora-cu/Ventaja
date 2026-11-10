# Ventaja · Sesión en navegador (Chrome) nº 4 — pendientes tras el PR #11

Eres Claude trabajando en Chrome con las sesiones ya abiertas del dueño de Ventaja (Frank). No hay claves nuevas que pegar: todo lo que necesitas ya está en Supabase y Vercel. Tu trabajo es cerrar los pendientes de la sesión 3, verificar el despliegue del PR #11 y entregar un informe en Markdown.

Datos del proyecto:
- Supabase: proyecto `bogbxetlznavpxjkidvt` (organización FYMED) → https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt
- Vercel: proyecto `ventaja`, equipo `c-c-projects1` → https://vercel.com/c-c-projects1/ventaja · app en https://ventaja-liard.vercel.app
- Repo: https://github.com/altiora-cu/Ventaja, rama `main`. Último commit fusionado: `067ea80` ("Partidos reprogramados sin duplicar y resumen del cron en el log (#11)").

No pegues ninguna clave en el informe. No crees claves nuevas.

---

## 1. Verificar el despliegue del PR #11

En https://vercel.com/c-c-projects1/ventaja/deployments comprueba que hay un despliegue **Ready** en Production del commit `067ea80`. Si el último Ready es de un commit anterior, abre el de `067ea80` (o lanza Redeploy del último sin caché) y espera a Ready. Anota el id del despliegue.

## 2. Borrar el partido duplicado (SQL Editor)

Abre https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt/sql/new y ejecuta primero esta comprobación. Debe devolver 2 filas de Sarmiento vs River Plate (ids 10000036 y 10000045):

```sql
select f.id, f.kickoff, f.status, f.home_goals, f.away_goals, h.name as home, a.name as away
from fixtures f join teams h on h.id = f.home_id join teams a on a.id = f.away_id
where f.id in (10000036, 10000045);
```

Si las dos filas son el mismo cruce, borra la vieja. Supabase avisará de "operación destructiva": confírmala, es intencional. Se borra con ella todo lo que cuelga de ese partido (predicciones, análisis y su pick cerrado en el Historial):

```sql
delete from fixtures where id = 10000036;
```

Vuelve a correr la consulta de comprobación: debe quedar solo 10000045.

## 3. Ejecutar el cron diario y leer su resumen en el log

1. En Vercel → proyecto `ventaja` → **Settings → Cron Jobs**, ejecuta `/api/cron/daily` si hay botón para lanzarlo. Si no hay botón, salta al punto 2 y lee la ejecución más reciente (corre sola a las 09:00 UTC).
2. En **Logs** (o en **Observability → Logs**), filtra por `[cron:daily]`. Desde el PR #11 cada cron escribe una línea `[cron:daily] ok en N ms {...}` con el resumen completo. Copia al informe, de ese JSON, los campos de cada paso: `fixtures` (incluido `rescheduled` y `staleResults`), `settle`, `settleUser`, `odds` (créditos restantes), `predict` (incluido `webAnalyses`), `accounts` y `push` (`configured`, `kickoffUsers`, `resultUsers`, `sent`, `removed`, `errors`).
3. Si hay líneas `[web-analysis] fallo` o cualquier `401`, cópialas.

## 4. Pruebas pendientes en la app (https://ventaja-liard.vercel.app, cuenta admin)

| # | Prueba | Qué comprobar |
|---|---|---|
| A | **Análisis IA con búsqueda web** | Jornada → filtra liga **MLS** (o cualquier liga sin cuotas con partido a ≤ 3 días) → abre una ficha. Debe aparecer el bloque "Análisis IA con búsqueda web" con jugada orientativa, estimación, riesgos y fuentes. Si no hay partido de MLS en 3 días, prueba Brasileirão Série B o Primera División de Chile. Si no sale en ninguna, revisa en Logs si `[web-analysis]` da error. |
| B | **Jugada ALTA o MEDIA** | Busca en Jornada (hoy y los próximos 3 días) un partido de **Liga Profesional Argentina**, **Liga MX** o **Brasileirão Série A** con cuotas. En su ficha, en Mercados, marca una jugada con sello ALTA o MEDIA. No debe salir el aviso "No recomendada". |
| C | **Boleto con mezcla** | Toca la burbuja flotante. Con la jugada BAJA de Londrina y la nueva ALTA/MEDIA debe decir "1 de 2 jugadas no son recomendadas por el modelo…", solo la BAJA lleva etiqueta ámbar, y abajo sale "Combinada con S/ 20: si gana cobras …". Pulsa **Guardar como combinada**: debe pasar a "Combinada guardada". |
| D | **Combinada en Mis jugadas** | En `/mis-jugadas`, sección Combinadas, aparece la combinada propia con 2 selecciones, campo Stake (20) y botón Quitar. En "En juego" siguen las 2 jugadas sueltas. |
| E | **Quitar con confirmación** | En la combinada, pulsa Quitar: el botón cambia a "¿Quitar?"; púlsalo otra vez y desaparece. Las 2 jugadas sueltas deben seguir. |
| F | **Partido de Londrina** | Si ya terminó Londrina vs Náutico PE: en `/mis-jugadas` la jugada debe estar en "Cerradas" con resultado (Ganada/Perdida/Nula) y balance en soles. Si no terminó, anótalo. |

Si no existe ningún partido con cuotas en 3 días (fecha FIFA), deja B, C, D y E como "sin partido disponible" y no fuerces nada.

## 5. Lo que NO puedes hacer tú (solo el dueño)

- Activar los avisos push: requiere aceptar el permiso del navegador en el teléfono del dueño. Anótalo como pendiente del dueño.
- Guardar como Secret las 5 variables con "Needs Attention": requiere que el dueño pegue los valores. Recomendación, no bloqueo.

## 6. Informe

Entrega `VENTAJA_INFORME_SESION_4.md` con:
1. Despliegue: id y commit del Ready en Production.
2. Duplicado: resultado de las dos consultas (antes y después).
3. Cron: el resumen de cada paso tal como salió en el log, y cualquier error.
4. Pruebas A–F: OK / falla + qué viste, con el partido usado en cada una.
5. Lo que no pudiste hacer y por qué.
6. Si viste algo raro en la app (texto cortado, números sin formato, errores en consola), descríbelo con la página y el paso.
