'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { updatePassword } from '@/app/actions/auth';

export function PasswordForm() {
  const t = useTranslations('cuenta');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await updatePassword(fd);
          setMsg(r.ok ? t('passwordUpdated') : r.error === 'short' ? t('passwordTooShort') : r.error ?? null);
        });
      }}
    >
      <input name="password" type="password" minLength={8} required placeholder={t('newPassword')} className="input sm:max-w-xs" autoComplete="new-password" />
      <button type="submit" className="btn btn-secondary" disabled={pending}>
        {t('changePassword')}
      </button>
      {msg && <p className="self-center text-sm text-muted">{msg}</p>}
    </form>
  );
}
