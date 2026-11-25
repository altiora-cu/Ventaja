-- =============================================================================
-- VENTAJA · Migración 11: cuotas para la UEFA Champions League
-- Sin cuotas no hay ventaja ni "mejores jugadas": todos los partidos de Champions salían sin recomendación.
-- La Champions juega pocos días al mes (~30 créditos/mes de The Odds API en modo económico): cabe en el plan gratis.
-- Idempotente.
-- =============================================================================
update public.leagues set odds_enabled = true where id = 2;
