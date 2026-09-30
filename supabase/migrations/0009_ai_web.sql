-- =============================================================================
-- VENTAJA · Migración 9: Análisis IA con búsqueda web
-- Para ligas sin cuotas (presupuesto) la IA investiga el partido en la web (forma, bajas,
-- contexto) y propone una jugada orientativa. Nunca sube de sello MEDIA y no entra en el
-- Historial verificado: es una capa de apoyo, no una ventaja calculada.
-- Idempotente.
-- =============================================================================
alter table public.leagues add column if not exists ai_web boolean not null default false;
alter table public.fixture_analysis add column if not exists ai_web jsonb;

-- Arranque: ligas activas con cobertura de calendario pero sin cuotas (Brasil, Argentina, Europa,
-- Sudamericana...). Cambiar con: update public.leagues set ai_web = true/false where id = <id>;
update public.leagues set ai_web = (active and odds_enabled = false);
