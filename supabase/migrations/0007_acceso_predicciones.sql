-- =============================================================================
-- VENTAJA · Migración 7: las predicciones de partidos por jugar dejan de ser públicas
-- Hasta ahora predictions y fixture_analysis se podían leer con la clave anónima
-- (política "using (true)" de la migración 1) y la app solo las ocultaba en pantalla.
-- Desde aquí:
--   - Partido terminado (FT, AET, PEN): lectura pública, como picks_history.
--   - Partido por jugar o en juego: solo con acceso vigente (prueba, pago o admin).
-- Las escrituras no cambian: siguen pasando por service_role, que no aplica RLS.
-- Idempotente.
--
-- Para deshacerla:
--   drop policy if exists "predictions_read" on public.predictions;
--   drop policy if exists "fixture_analysis_read" on public.fixture_analysis;
--   create policy "predictions_public_read" on public.predictions for select using (true);
--   create policy "fixture_analysis_public_read" on public.fixture_analysis for select using (true);
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Predicciones
--    "(select public.has_access())" se evalúa una vez por consulta, no una vez por fila.
-- -----------------------------------------------------------------------------
drop policy if exists "predictions_public_read" on public.predictions;
drop policy if exists "predictions_read" on public.predictions;
create policy "predictions_read" on public.predictions
  for select using (
    (select public.has_access())
    or exists (
      select 1 from public.fixtures f
      where f.id = predictions.fixture_id and f.status in ('FT','AET','PEN')
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Análisis del partido (Lectura, mercado principal y Revisión IA)
-- -----------------------------------------------------------------------------
drop policy if exists "fixture_analysis_public_read" on public.fixture_analysis;
drop policy if exists "fixture_analysis_read" on public.fixture_analysis;
create policy "fixture_analysis_read" on public.fixture_analysis
  for select using (
    (select public.has_access())
    or exists (
      select 1 from public.fixtures f
      where f.id = fixture_analysis.fixture_id and f.status in ('FT','AET','PEN')
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Contador de picks en juego para quien aún no tiene acceso.
--    El historial muestra "hay N picks en juego" como invitación a activar la cuenta.
--    La función devuelve solo el número; no expone ninguna selección.
-- -----------------------------------------------------------------------------
create or replace function public.open_picks_count()
returns integer
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where p.sello in ('alta','media')
    and f.status in ('NS','TBD')
    and f.kickoff > now();
$$;

revoke all on function public.open_picks_count() from public;
grant execute on function public.open_picks_count() to anon, authenticated;
