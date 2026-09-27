-- =============================================================================
-- VENTAJA · Migración 2: Revisión IA del pick principal
-- Idempotente: se puede ejecutar aunque 0001 ya incluyera lectura_en.
-- =============================================================================
alter table public.fixture_analysis add column if not exists lectura_en text;
alter table public.fixture_analysis add column if not exists ai_review jsonb;
-- ai_review: { verdict: 'concuerda'|'cautela'|'discrepa', risks: string[], note: string,
--              sello_modelo, sello_final, model, key, at }
