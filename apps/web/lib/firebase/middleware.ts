import { NextResponse, type NextRequest } from 'next/server';
import { FIREBASE_SESSION_COOKIE } from './cookies';

const publicRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/csrf',
  '/auth/session',
  '/auth/error',
  '/support',
  '/api/support',
];

function isPublicRoute(pathname: string) {
  return publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

function clearSession(response: NextResponse) {
  response.cookies.set(FIREBASE_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  return response;
}

export function updateFirebaseSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const recoveringInvalidSession =
    (pathname === '/login' || pathname === '/signup') &&
    request.nextUrl.searchParams.get('error') === 'session_expired';
  if (recoveringInvalidSession) return clearSession(NextResponse.next({ request }));

  const signedIn = Boolean(request.cookies.get(FIREBASE_SESSION_COOKIE)?.value);
  if (!signedIn && !isPublicRoute(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ detail: 'Sign in required' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (signedIn && (pathname === '/login' || pathname === '/signup')) {
    const workspaceUrl = request.nextUrl.clone();
    workspaceUrl.pathname = '/workspace';
    workspaceUrl.search = '';
    return NextResponse.redirect(workspaceUrl);
  }
  return NextResponse.next({ request });
}
