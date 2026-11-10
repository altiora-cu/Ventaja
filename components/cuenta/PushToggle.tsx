'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { removePushSubscription, savePushSubscription, sendTestPush } from '@/app/actions/push';
import { IconCheck } from '@/components/ui/Icons';

type State = 'checking' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** iOS/iPadOS solo permite Web Push en la app instalada en la pantalla de inicio. */
function isIosBrowserTab(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Activa o desactiva los avisos push en este dispositivo. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations('push');
  const [state, setState] = useState<State>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!publicKey) return setState('unsupported');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState(isIosBrowserTab() ? 'needs-install' : 'unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, [publicKey]);

  const enable = () =>
    start(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return setState('denied');
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) }));
        const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (!res.ok) return setMessage(res.error ?? t('error'));
        setState('on');
        const test = await sendTestPush();
        setMessage(test.ok ? t('testSent') : t('testFailed'));
      } catch {
        setMessage(t('error'));
      }
    });

  const disable = () =>
    start(async () => {
      setMessage(null);
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setState('off');
      } catch {
        setMessage(t('error'));
      }
    });

  if (state === 'checking') return <p className="text-xs text-faint">{t('checking')}</p>;
  if (state === 'unsupported') return <p className="text-sm text-muted">{publicKey ? t('unsupported') : t('notConfigured')}</p>;
  if (state === 'needs-install') return <p className="text-sm text-muted">{t('needsInstall')}</p>;
  if (state === 'denied') return <p className="text-sm text-muted">{t('denied')}</p>;

  return (
    <div className="space-y-2">
      {state === 'on' ? (
        <>
          <p className="flex items-center gap-1.5 text-sm text-ventaja">
            <IconCheck width={16} height={16} /> {t('on')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => setMessage((await sendTestPush()).ok ? t('testSent') : t('testFailed')))}>
              {t('sendTest')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={disable}>
              {t('disable')}
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn-primary" disabled={pending} onClick={enable}>
          {t('enable')}
        </button>
      )}
      {message && (
        <p className="text-xs text-muted" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
