import type { Metadata, Viewport } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/shell/AppShell';
import { RegisterSW } from '@/components/pwa/RegisterSW';
import { appUrl } from '@/lib/utils';
import './globals.css';

const interTight = Inter_Tight({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-ui', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-mono', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  const title = `${t('appName')} — ${t('tagline')}`;
  return {
    metadataBase: new URL(appUrl()),
    title: { default: title, template: `%s · ${t('appName')}` },
    description: t('disclaimer'),
    applicationName: t('appName'),
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: t('appName') },
    openGraph: { title, description: t('tagline'), type: 'website', siteName: t('appName'), locale: 'es_US' },
    twitter: { card: 'summary_large_image', title, description: t('tagline') },
    robots: { index: true, follow: true },
    icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
  };
}

export const viewport: Viewport = {
  themeColor: '#0B0F14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${interTight.variable} ${jetbrains.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/New_York">
          <AppShell>{children}</AppShell>
          <RegisterSW />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
