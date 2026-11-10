import { getLocale } from 'next-intl/server';
import { BoletoFlotante, type BoletoPlay } from '@/components/jugadas/BoletoFlotante';
import type { Viewer } from '@/lib/auth/viewer';
import { getOpenPlays } from '@/lib/data/jugadas';
import { selectionLabel } from '@/lib/labels';
import { getTimeZone } from '@/lib/tz';
import { DEFAULT_STAKE } from '@/lib/engine/money';
import { fmtDate, fmtTime } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

/** Lee las jugadas en juego del usuario y las entrega ya formateadas a la burbuja. Sin sesión o sin acceso no renderiza nada. */
export async function JugadasBubble({ viewer }: { viewer: Viewer }) {
  if (!viewer.user || !viewer.access.canAccess) return null;
  const [data, locale] = await Promise.all([getOpenPlays(viewer.user.id), getLocale() as Promise<Locale>]);
  if (data.plays.length === 0 && data.openCombos === 0) return null;
  const timeZone = getTimeZone();
  const today = fmtDate(new Date(), locale, { day: 'numeric', month: 'short' }, timeZone);
  const plays: BoletoPlay[] = data.plays.map((p) => {
    const day = fmtDate(p.kickoff, locale, { day: 'numeric', month: 'short' }, timeZone);
    return {
      id: p.id,
      fixtureId: p.fixtureId,
      match: `${p.home} vs ${p.away}`,
      time: day === today ? fmtTime(p.kickoff, locale, timeZone) : `${day} ${fmtTime(p.kickoff, locale, timeZone)}`,
      label: selectionLabel(p.market, p.selection, p.line, { home: p.home, away: p.away, player: p.playerName }, locale),
      prob: p.prob,
      price: p.price,
      stake: p.stake,
      warning: p.warning,
    };
  });
  const profile = viewer.profile;
  const defaultStake = Number(profile?.default_stake);
  return <BoletoFlotante plays={plays} openCombos={data.openCombos} currency={profile?.currency ?? 'USD'} defaultStake={Number.isFinite(defaultStake) && defaultStake > 0 ? defaultStake : DEFAULT_STAKE} locale={locale} />;
}
