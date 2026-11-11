# Ventaja · Sesión en navegador (Chrome) nº 5 — pendientes tras el PR #13

Eres Claude trabajando en Chrome con las sesiones ya abiertas del dueño de Ventaja (Frank). No hay claves que pegar ni SQL que ejecutar. Tu trabajo es verificar el despliegue del PR #13, comprobar que la carga automática de marcadores por búsqueda web funciona, cerrar las pruebas que quedaron sin partido y entregar un informe en Markdown.

Datos del proyecto:
- Supabase: proyecto `bogbxetlznavpxjkidvt` (organización FYMED) → https://supabase.com/dashboard/project/bogbxetlznavpxjkidvt
- Vercel: proyecto `ventaja`, equipo `c-c-projects1` → https://vercel.com/c-c-projects1/ventaja · app en https://ventaja-liard.vercel.app
- Repo: https://github.com/altiora-cu/Ventaja, rama `main`. Último commit fusionado: `cacbdeb` ("Marcadores por búsqueda web, conteo de marcadores en la ingesta y arreglos en Mis jugadas (#13)").

No pegues ninguna clave en el informe. No crees claves nuevas. No cargues marcadores a mano en `/admin` antes del paso 2: la idea es comprobar que la IA los carga sola.

---

## 1. Verificar el despliegue

En https://vercel.com/c-c-projects1/ventaja/deployments comprueba que hay un despliegue **Ready** en Production del commit `cacbdeb`. Si no lo hay, lanza Redeploy del último sin caché y espera a Ready. Anota el id.

## 2. Marcadores por búsqueda web (lo más importante de esta sesión)

Antes de ejecutar nada, abre https://ventaja-liard.vercel.app/admin y anota la lista de partidos con más de 3 días sin marcador (deberían ser los 6 de Liga Profesional Argentina del 08/11: Unión vs Vélez, San Lorenzo vs Platense, Independiente vs Riestra, Gimnasia vs Belgrano, Barracas vs Racing, Aldosivi vs River).

Luego, en Vercel → `ventaja` → Settings → Cron Jobs, ejecuta `/api/cron/daily` (si no hay botón, usa la ejecución automática de las 09:00 UTC y lee su log).

En **Logs**, filtra por `[cron:daily]` y copia con "Copy log message" el JSON completo. Del resumen necesito:
- `fixtures.scores` → `needed`, `received`, `updated`, `skippedTtl`.
- `webScores` → `enabled`, `stale`, `asked`, `updated`, `postponed`, `unresolved`, `skippedRecent`, `errors`.
- `settle` y `settleUser` → cuántos picks y jugadas se cerraron.
- `push` → `sent`.

Filtra también por `[web-scores]`: hay una línea por partido cargado con el marcador y la fuente. Cópialas todas al informe. Si hay líneas `[web-scores] fallo`, cópialas.

Después vuelve a `/admin`: la lista de partidos sin marcador debe haber bajado (idealmente a 0). Anota cuántos quedan y cuáles.

Comprobación cruzada: elige 2 de los marcadores cargados por la IA y verifícalos tú en ESPN o Flashscore. Anota si coinciden. Si alguno NO coincide, dilo en el informe en un apartado destacado y no lo corrijas: lo revisará el desarrollador.

Si `webScores.enabled` es `false`, la clave de Anthropic no está llegando al servidor: anótalo y pasa al punto 3.

## 3. Pruebas que quedaron sin partido (sesión 4)

Necesitan un partido con cuotas y predicciones calculadas. Candidatos: Querétaro vs Monterrey (Liga MX, 14/11), Mirassol vs Atlético Mineiro y Chapecoense vs Vasco (Brasileirão Série A, 14/11). Entra a la ficha; si todavía dice "Las predicciones de este partido aún no están calculadas", el cron del punto 2 debería haberlas calculado ya (`predict.fixtures` en el resumen). Si siguen sin calcular, anótalo y deja estas pruebas como pendientes.

| # | Prueba | Qué comprobar |
|---|---|---|
| B | Jugada ALTA o MEDIA | En Mercados de la ficha, marca una jugada con sello ALTA o MEDIA. No debe salir "No recomendada". |
| C | Boleto con mezcla | Toca la burbuja flotante. Con la jugada BAJA de Londrina (si sigue en juego) y la nueva: "1 de 2 jugadas no son recomendadas…", solo la BAJA con etiqueta ámbar, y "Combinada con S/ 20: si gana cobras …". Pulsa **Guardar como combinada** → "Combinada guardada". Si Londrina ya se jugó, marca una segunda jugada BAJA de otro partido para la prueba. |
| D | Combinada en Mis jugadas | En `/mis-jugadas`, Combinadas: la combinada propia con 2 selecciones, campo Stake y botón Quitar. |
| E | Quitar con confirmación | Pulsa Quitar en la combinada → "¿Quitar?" → otra vez → desaparece. Las jugadas sueltas siguen. |

## 4. Jugada de Londrina (prueba F de la sesión 4)

Londrina vs Náutico PE se jugó el 11/11 a las 5:00 p.m. (Lima). En `/mis-jugadas` la jugada "Menos de 3.5" debe estar en **Cerradas** con Ganada/Perdida/Nula y el balance en soles con stake S/ 15. Comprueba también que en el **Registro de victorias** cambiaron Ganadas/Perdidas y la tabla del mes dice "Noviembre de 2026" con columnas "G-P", "Unidades" y "Balance".

Si sigue en "En juego", mira en `/admin` si el partido aparece sin marcador y anótalo: el cron debería cerrarlo (Série B tiene marcadores en The Odds API).

## 5. Revisión rápida de interfaz

En `/mis-jugadas` y en una ficha de partido, en el móvil del dueño o con Chrome a 375 px de ancho (DevTools → modo dispositivo): anota cualquier texto cortado, número sin formato o elemento tapado por la burbuja flotante o la barra inferior.

## 6. Lo que NO puedes hacer tú (dueño)

- Activar los avisos push desde el teléfono. Sigue pendiente desde la sesión 3. Si el dueño ya lo hizo, en el resumen del cron `push.sent` será mayor que 0 cuando haya jugadas que avisar.
- Guardar como Secret las 5 variables con "Needs Attention". Recomendación, no bloqueo.

## 7. Informe

Entrega `VENTAJA_INFORME_SESION_5.md` con:
1. Despliegue: id y commit del Ready.
2. Marcadores web: lista de `/admin` antes y después, los campos del resumen del cron, las líneas `[web-scores]` y el resultado de la comprobación cruzada.
3. Pruebas B–E: OK / falla / pendiente, con el partido usado.
4. Londrina: estado de la jugada y del registro.
5. Observaciones de interfaz.
6. Lo que no pudiste hacer y por qué.
