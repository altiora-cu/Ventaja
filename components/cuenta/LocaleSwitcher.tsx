'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/app/actions/locale';
import { locales } from '@/i18n/config';

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={t('language')}>
      {locales.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={locale === l} className="chip" data-active={locale === l} disabled={pending} onClick={() => start(() => setLocale(l))}>
          {l === 'es' ? t('spanish') : t('english')}
        </button>
      ))}
    </div>
  );
}
