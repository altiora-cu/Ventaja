-- =============================================================================
-- VENTAJA · Migración 8: presupuesto de cuotas por liga
-- Con 14 ligas activas el plan gratis de The Odds API (500 créditos/mes) no alcanza.
-- `odds_enabled` decide qué ligas piden cuotas (y por tanto tienen ventaja y sellos);
-- el resto sigue con calendario, resultados y probabilidades del modelo.
-- Idempotente.
-- =============================================================================
alter table public.leagues add column if not exists odds_enabled boolean not null default true;

-- Arranque: solo las 5 ligas del MVP con cobertura de cuotas. Cambiar desde el SQL Editor:
--   update public.leagues set odds_enabled = true where id = <id>;
update public.leagues set odds_enabled = (id in (39, 262, 253, 13, 128));
