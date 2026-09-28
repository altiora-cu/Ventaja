-- =============================================================================
-- VENTAJA · Migración 6: ligas de Europa
-- Calendario, resultados y temporada completa: football-data.org (plan gratuito).
-- Cuotas: The Odds API.
-- Activas: las cinco grandes y la Champions League. Eredivisie, Primeira Liga y
-- Championship quedan registradas pero inactivas: cada liga activa gasta créditos
-- de The Odds API y el plan gratuito no alcanza para todas.
-- Idempotente. Los id son los de API-Football, como en el resto de la tabla.
-- =============================================================================

insert into public.leagues (id, name, country, season, odds_sport_key, fd_code, active) values
  (140, 'La Liga', 'Spain', 2026, 'soccer_spain_la_liga', 'PD', true),
  (135, 'Serie A', 'Italy', 2026, 'soccer_italy_serie_a', 'SA', true),
  (78,  'Bundesliga', 'Germany', 2026, 'soccer_germany_bundesliga', 'BL1', true),
  (61,  'Ligue 1', 'France', 2026, 'soccer_france_ligue_one', 'FL1', true),
  (2,   'UEFA Champions League', 'World', 2026, 'soccer_uefa_champs_league', 'CL', true),
  (88,  'Eredivisie', 'Netherlands', 2026, 'soccer_netherlands_eredivisie', 'DED', false),
  (94,  'Primeira Liga', 'Portugal', 2026, 'soccer_portugal_primeira_liga', 'PPL', false),
  (40,  'Championship', 'England', 2026, 'soccer_efl_champ', 'ELC', false)
on conflict (id) do update set
  odds_sport_key = excluded.odds_sport_key,
  fd_code = excluded.fd_code;
-- En conflicto no se toca `active`: si el dueño encendió o apagó una liga, se respeta.
