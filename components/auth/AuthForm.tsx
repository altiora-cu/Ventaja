'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'register';

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') && params.get('next')!.startsWith('/') ? params.get('next')! : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (mode === 'register' && !age) return setMsg({ kind: 'error', text: t('ageRequired') });
    if (password.length < 8) return setMsg({ kind: 'error', text: t('weakPassword') });
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setMsg({ kind: 'error', text: t('invalidCredentials') });
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback(), data: { locale } } });
        if (error) return setMsg({ kind: 'error', text: /registered|exists/i.test(error.message) ? t('emailInUse') : t('unexpected') });
        if (data.session) {
          router.replace('/');
          router.refresh();
        } else setMsg({ kind: 'info', text: t('checkEmail') });
      }
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (mode === 'register' && !age) return setMsg({ kind: 'error', text: t('ageRequired') });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
  };

  const magic = async () => {
    if (!email) return;
    if (mode === 'register' && !age) return setMsg({ kind: 'error', text: t('ageRequired') });
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(), data: { locale } } });
    setBusy(false);
    setMsg(error ? { kind: 'error', text: t('unexpected') } : { kind: 'info', text: t('magicSent') });
  };

  const reset = async () => {
    if (!email) return;
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/cuenta` });
    setMsg({ kind: 'info', text: t('resetSent') });
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-semibold">{mode === 'login' ? t('loginTitle') : t('registerTitle')}</h1>
      {mode === 'register' && <p className="mt-1 text-muted">{t('registerSubtitle')}</p>}

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} className="input" autoComplete="email" />
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} className="input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {mode === 'register' && (
          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--ventaja)]" />
            <span>{t('ageConfirm')}</span>
          </label>
        )}
        {msg && <p className={`text-sm ${msg.kind === 'error' ? 'text-fallo' : 'text-ventaja'}`}>{msg.text}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {mode === 'login' ? t('login') : t('register')}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" />
        {t('or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2">
        <button type="button" className="btn btn-secondary w-full" onClick={google} disabled={busy}>
          {t('google')}
        </button>
        <button type="button" className="btn btn-ghost w-full" onClick={magic} disabled={busy || !email}>
          {t('magic')}
        </button>
        {mode === 'login' && (
          <button type="button" className="btn btn-ghost btn-sm w-full text-muted" onClick={reset} disabled={!email}>
            {t('forgot')}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
        <Link href={mode === 'login' ? '/registro' : '/login'} className="text-ventaja hover:underline">
          {mode === 'login' ? t('register') : t('login')}
        </Link>
      </p>
      <p className="mt-8 text-center text-xs leading-relaxed text-faint">{tc('disclaimer')}</p>
    </div>
  );
}
