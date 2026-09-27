import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { resolveStatus } from '@/lib/auth/status';
import type { Profile } from '@/lib/db/types';

/**
 * Rutas públicas: accesibles sin sesión y con cuenta vencida.
 * Todo lo demás requiere sesión y acceso vigente (trial/activa/admin).
 * El bloqueo se decide SIEMPRE en servidor con las fechas del perfil (nunca localStorage).
 */
const PUBLIC_PATHS = ['/', '/historial', '/login', '/registro', '/legal', '/activar', '/auth', '/api', '/manifest.webmanifest', '/sw.js', '/opengraph-image', '/icon', '/apple-icon', '/offline'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some((p) => p !== '/' && (pathname === p || pathname.startsWith(p + '/')));
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!supabase) return response; // sin Supabase configurado: dejar pasar (modo demo)

  if (isPublic(pathname)) {
    // Usuario ya logueado que entra a /login → jornada
    if (user && (pathname === '/login' || pathname === '/registro')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  if (!user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,status,trial_ends_at,paid_until')
    .eq('id', user.id)
    .maybeSingle<Pick<Profile, 'role' | 'status' | 'trial_ends_at' | 'paid_until'>>();

  if (!profile) return response; // perfil aún creándose (trigger): dejar pasar una vez

  const access = resolveStatus(profile);

  if (pathname.startsWith('/admin') && access.status !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!access.canAccess) {
    return NextResponse.redirect(new URL('/activar', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)'],
};
