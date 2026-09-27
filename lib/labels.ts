import es from '@/messages/es.json';
import en from '@/messages/en.json';
import type { Locale } from '@/i18n/config';
import { fmtLine } from './utils';

type Outcome = Record<string, string>;
const MSG: Record<Locale, { markets: Record<string, string | Outcome> }> = { es: es as never, en: en as never };

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export interface LabelCtx {
  home: string;
  away: string;
  player?: string | null;
}

/** Nombre del mercado (ej. "Goles totales"). */
export function marketName(market: string, locale: Locale = 'es'): string {
  const m = MSG[locale].markets[market];
  return typeof m === 'string' ? m : market;
}

/**
 * Etiqueta legible de una selección: "Gana Tigres", "Más de 2.5", "Tigres −0.5", "1T: más de 0.5", "Gignac anota".
 * Es una función pura compartida por servidor (cron, OG) y UI.
 */
export function selectionLabel(market: string, selection: string, line: number | null, ctx: LabelCtx, locale: Locale = 'es'): string {
  const o = MSG[locale].markets.outcome as Outcome;
  const L = line === null || line === undefined ? '' : String(line);
  const team = (s: string) => (s.startsWith('home') || s === '1X' || s === 'ah_home' || s.endsWith('_home') ? ctx.home : ctx.away);

  switch (market) {
    case '1x2':
      return fill(o[selection] ?? selection, { team: team(selection) });
    case 'dc':
      return fill(o[selection] ?? selection, { team: selection === '1X' ? ctx.home : ctx.away });
    case 'totals':
    case 'corners':
    case 'cards':
      return `${marketName(market, locale)} · ${fill(o[selection] ?? selection, { line: L })}`;
    case 'team_totals':
    case 'sot': {
      const [side, dir] = selection.split('_');
      const label = fill(o[`team_${dir}`] ?? selection, { team: side === 'home' ? ctx.home : ctx.away, line: L });
      return market === 'sot' ? `${marketName(market, locale)} · ${label}` : label;
    }
    case 'btts':
      return `${marketName(market, locale)}: ${o[selection] ?? selection}`;
    case 'ah':
      return fill(o[selection] ?? selection, { team: team(selection), line: fmtLine(line) });
    case 'ht':
    case '2h':
      return fill(o[selection] ?? selection, { team: team(selection), line: L });
    case 'player_sot':
      return `${ctx.player ?? ''} · ${fill(o[selection] ?? selection, { line: L })} ${locale === 'es' ? 'tiros a puerta' : 'shots on target'}`;
    case 'scorer':
      return fill(o.scores, { player: ctx.player ?? '' });
    default:
      return `${market} ${selection} ${L}`.trim();
  }
}
