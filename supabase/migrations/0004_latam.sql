-- =============================================================================
-- VENTAJA · Migración 4: ligas de Latinoamérica
-- Brasil Série A y B, Copa Sudamericana y Primera de Chile (The Odds API).
-- Série A y Copa Libertadores usan además football-data.org (temporada completa).
-- Idempotente. Los id son los de API-Football, como en el resto de la tabla.
-- =============================================================================

insert into public.leagues (id, name, country, season, odds_sport_key, fd_code, active) values
  (71,  'Brasileirão Série A', 'Brazil', 2026, 'soccer_brazil_campeonato', 'BSA', true),
  (72,  'Brasileirão Série B', 'Brazil', 2026, 'soccer_brazil_serie_b', null, true),
  (11,  'Copa Sudamericana', 'World', 2026, 'soccer_conmebol_copa_sudamericana', null, true),
  (265, 'Primera División de Chile', 'Chile', 2026, 'soccer_chile_campeonato', null, true)
on conflict (id) do update set
  odds_sport_key = excluded.odds_sport_key,
  fd_code = excluded.fd_code,
  active = excluded.active;

-- Copa Libertadores: football-data.org pasa a ser el calendario maestro.
update public.leagues set fd_code = 'CLI' where id = 13;

-- Evita duplicados: los partidos pendientes que entraron por The Odds API se vuelven a cargar desde football-data.org.
delete from public.fixtures where league_id = 13 and source = 'odds_api' and status in ('NS', 'TBD');
delete from public.ingest_log where key in ('calendar:odds_api:13:2026', 'odds-link:13');
