# Ventaja · Sesión en navegador (Chrome) nº 6 — limpieza de duplicados y visto bueno para compartir con amigos

Eres Claude trabajando en Chrome con las sesiones ya abiertas del dueño de Ventaja (Frank). No hay claves que pegar. Tu trabajo: limpiar los partidos duplicados que quedaron en la base, verificar el despliegue del PR #15, cerrar las pruebas pendientes y comprobar que un amigo puede registrarse y usar la app. Entregas un informe en Markdown.

Datos del proyecto:
- Supabase: proyecto `bogbxetlznavpxjkidvt` (organización FYMED) → https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt
- Vercel: proyecto `ventaja`, equipo `c-c-projects1` → https://vercel.com/c-c-projects1/ventaja · app en https://ventaja-liard.vercel.app
- Repo: https://github.com/altiora-cu/Ventaja, rama `main`. Último commit de código: `d88fdd5` ("Huérfanos de reprogramación en la carga web de marcadores, tarjeta de racha y plurales (#15)").

No pegues ninguna clave en el informe. No crees claves nuevas.

---

## 1. Verificar el despliegue

En https://vercel.com/c-c-projects1/ventaja/deployments debe haber un despliegue **Ready** en Production de `d88fdd5` o de un commit posterior. Si no, Redeploy del último sin caché. Anota el commit.

## 2. Limpiar los partidos duplicados (SQL Editor)

Abre https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt/sql/new.

**2a. Ver los pares duplicados.** Ejecuta y copia el resultado completo al informe:

```sql
select f.id as viejo, g.id as nuevo, l.name as liga, h.name as local, a.name as visita,
       f.kickoff as fecha_vieja, g.kickoff as fecha_nueva, f.status as status_viejo, g.status as status_nuevo,
       f.home_goals || '-' || f.away_goals as marcador_viejo, g.home_goals || '-' || g.away_goals as marcador_nuevo
from fixtures f
join fixtures g on g.league_id = f.league_id and g.home_id = f.home_id and g.away_id = f.away_id and g.id <> f.id
  and g.kickoff between f.kickoff - interval '7 days' and f.kickoff + interval '7 days' and g.id > f.id
join leagues l on l.id = f.league_id join teams h on h.id = f.home_id join teams a on a.id = f.away_id
order by f.kickoff desc;
```

Se esperan pares de Liga Profesional Argentina de principios de noviembre (Unión–Vélez, Independiente–Riestra, Gimnasia–Belgrano, Barracas–Racing, Aldosivi–River, San Lorenzo–Platense) y quizá alguno de Chile u octubre.

**2b. Revisar antes de borrar.** Para cada par, comprueba:
- Que es el mismo cruce (mismos equipos, misma liga).
- Si los dos tienen marcador, que coinciden. Si NO coinciden, no borres ese par: anótalo en el informe en un apartado destacado.

**2c. Comprobar que nadie marcó jugadas en los viejos:**

```sql
select up.fixture_id, count(*) as jugadas
from user_picks up
where up.fixture_id in (
  select f.id from fixtures f
  join fixtures g on g.league_id = f.league_id and g.home_id = f.home_id and g.away_id = f.away_id and g.id <> f.id
    and g.kickoff between f.kickoff - interval '7 days' and f.kickoff + interval '7 days' and g.id > f.id
)
group by up.fixture_id;
```

Si devuelve filas, no borres esos partidos: anótalos. Si devuelve vacío, sigue.

**2d. Borrar el viejo de cada par.** Supabase avisará de operación destructiva; es intencional. Si en 2b hubo pares con marcadores distintos o en 2c hubo jugadas, NO uses esta consulta general: borra uno por uno con `delete from fixtures where id = <viejo>;` solo los pares limpios.

```sql
delete from fixtures f using fixtures g
where g.league_id = f.league_id and g.home_id = f.home_id and g.away_id = f.away_id and g.id <> f.id
  and g.kickoff between f.kickoff - interval '7 days' and f.kickoff + interval '7 days' and g.id > f.id;
```

**2e.** Vuelve a ejecutar la consulta 2a: debe devolver 0 filas (o solo los pares que dejaste a propósito).

## 3. Ejecutar el cron y leer el resumen

Vercel → `ventaja` → Settings → Cron Jobs → ejecuta `/api/cron/daily`. En Logs, filtra `[cron:daily]` y copia el JSON con "Copy log message". Del resumen necesito:
- `fixtures` → `rescheduled`, `staleResults`, `scores`.
- `webScores` → todos los campos, incluidos los nuevos `duplicatesRemoved` y `duplicatesSettled`.
- `stats.teamStats`, `settle`, `settleUser`, `predict` (`fixtures`, `predictions`, `lecturas`, `revisiones`, `webAnalyses`), `odds` (créditos restantes), `push`.

Copia también las líneas `[web-scores]` y cualquier `fallo` o `401`. Después abre `/admin` y anota cuántos partidos quedan sin marcador.

## 4. Prueba de registro como amigo (lo que van a hacer los invitados)

En una **ventana de incógnito**:
1. Abre https://ventaja-liard.vercel.app/registro y crea una cuenta con un correo de prueba (por ejemplo, el correo del dueño con `+prueba1` antes de la arroba) y una contraseña de 12 caracteres. Debe entrar directo, sin pedir confirmar el correo.
2. Debe verse la Jornada con partidos desbloqueados y el aviso de prueba gratis de 31 días en `/cuenta`.
3. Abre una ficha, marca una jugada, comprueba que aparece la burbuja flotante y que `/mis-jugadas` la muestra en "En juego".
4. En la pantalla de registro hay un botón de **Google**. En Supabase → Authentication → Providers comprueba si Google está **Enabled**. Anota sí o no. Si está deshabilitado, anótalo como aviso: los invitados deben registrarse con correo.
5. En Supabase → Authentication → Users confirma que el usuario de prueba aparece, y en Table Editor → `profiles` que tiene `trial_ends_at` a 31 días y `status = trial`. Deja la cuenta creada; anota el correo usado.

## 5. Pruebas que siguen pendientes (necesitan partido con cuotas)

Candidatos del 14/11: Querétaro vs Monterrey (Liga MX), Mirassol vs Atlético Mineiro y Chapecoense vs Vasco (Série A). Tras el cron del paso 3 ya deberían tener predicciones.

| # | Prueba | Qué comprobar |
|---|---|---|
| B | Jugada ALTA o MEDIA | En Mercados de la ficha, marca una con sello ALTA o MEDIA. No debe salir "No recomendada". Si ningún mercado llega a MEDIA, anota los sellos que ves y usa la de mayor ventaja. |
| C | Boleto con mezcla | Marca además una jugada BAJA de otro partido. En la burbuja: "1 de 2 jugadas no son recomendadas…", etiqueta ámbar solo en la BAJA, y "Combinada con S/ 20: si gana cobras …". Pulsa **Guardar como combinada** → "Combinada guardada". |
| D | Combinada en Mis jugadas | Aparece en Combinadas con 2 selecciones, campo Stake y Quitar. |
| E | Quitar con confirmación | Quitar → "¿Quitar?" → otra vez → desaparece. Las sueltas siguen. |
| F | Londrina vs Náutico PE (11/11) | La jugada "Menos de 3.5" debe estar en **Cerradas** con resultado y balance en soles (stake S/ 15). En el Registro de victorias cambia Ganadas o Perdidas y aparece la fila "Noviembre de 2026". |
| G | Tarjeta Racha | Muestra un número con signo (por ejemplo `+1`) y debajo "1 ganada seguida · mejor 1 · peor 0". Sin texto grande partido en varias líneas. |

Si las predicciones del 14/11 siguen sin calcular, anótalo con el valor de `predict.fixtures` y deja B–E pendientes.

## 6. Lo que NO puedes hacer tú (dueño)

- Activar los avisos push desde su teléfono.
- Guardar como Secret las 5 variables con "Needs Attention".

## 7. Informe

Entrega `VENTAJA_INFORME_SESION_6.md` con:
1. Despliegue: commit del Ready.
2. Duplicados: resultado de 2a (antes), de 2c, qué borraste y resultado de 2e (después).
3. Cron: campos del resumen y líneas `[web-scores]`; partidos sin marcador que quedan en `/admin`.
4. Registro como amigo: resultado de cada paso, estado del proveedor Google, correo de la cuenta de prueba.
5. Pruebas B–G: OK / falla / pendiente, con el partido usado.
6. **Veredicto para compartir:** una frase: "lista para compartir con amigos" o "no compartir todavía porque …".
7. Lo que no pudiste hacer y por qué.
