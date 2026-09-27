import type { ReactNode } from 'react';
import { getViewer } from '@/lib/auth/viewer';
import { whatsappLink } from '@/lib/utils';
import { Header } from './Header';
import { BottomNav, Sidebar } from './Nav';
import { Footer } from './Footer';
import { TrialBanner } from './TrialBanner';
import { RecordatorioPago } from './RecordatorioPago';

export async function AppShell({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const { access, profile } = viewer;
  const email = profile?.email ?? viewer.user?.email ?? null;
  const showBanner = access.needsReminder && access.daysLeft !== null;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-elevated focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <Header viewer={viewer} />
      {showBanner && <TrialBanner days={access.daysLeft!} email={email} />}
      <div className="mx-auto flex w-full max-w-app flex-1 gap-8 px-4 pt-6 lg:px-8">
        <Sidebar showAdmin={viewer.isAdmin} loggedIn={Boolean(viewer.user)} />
        <main id="contenido" className="min-w-0 flex-1 pb-8">
          {children}
        </main>
      </div>
      <Footer />
      <BottomNav />
      {viewer.showReminder && access.daysLeft !== null && <RecordatorioPago days={access.daysLeft} isRenewal={access.isRenewal} whatsappUrl={whatsappLink(email)} />}
    </div>
  );
}
