import { getLocale, getTranslations } from 'next-intl/server';
import { Sello } from '@/components/ui/Sello';
import type { AiWebAnalysis } from '@/lib/db/types';
import { webPickLabel } from '@/lib/labels';
import { pct } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

/** Tarjeta del Análisis IA con búsqueda web (partidos sin cuotas). */
export async function AnalisisWeb({ analysis, home, away }: { analysis: AiWebAnalysis; home: string; away: string }) {
  const t = await getTranslations('partido');
  const locale = (await getLocale()) as Locale;
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t('aiWeb')}</p>
        <Sello nivel={analysis.confidence} animate={false} />
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-faint">{t('aiWebPick')}</p>
          <p className="text-lg font-medium">{webPickLabel(analysis.pick, { home, away }, locale)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-faint">{t('aiWebEstimate')}</p>
          <p className="num text-2xl">{pct(analysis.prob)}</p>
        </div>
      </div>
      <p className="mt-3 max-w-lectura text-base leading-relaxed">{analysis.summary}</p>
      {analysis.risks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {analysis.risks.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-muted">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden="true" />
              {r}
            </li>
          ))}
        </ul>
      )}
      {analysis.sources.length > 0 && (
        <p className="mt-3 text-xs text-faint">
          {t('aiWebSources')}:{' '}
          {analysis.sources.map((s, i) => (
            <a key={s} href={s} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-muted">
              [{i + 1}]
            </a>
          ))}
        </p>
      )}
      <p className="mt-3 text-xs text-faint">{t('aiWebDisclaimer')}</p>
    </section>
  );
}
