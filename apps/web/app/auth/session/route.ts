import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase/admin';
import {
  FIREBASE_CSRF_COOKIE,
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE,
} from '@/lib/firebase/cookies';

export const runtime = 'nodejs';

const ACTIVE_SCHOOL_COOKIE = 'harambee-school-id';

function sameOrigin(request: NextRequest) {
  return request.headers.get('origin') === request.nextUrl.origin;
}

function equalToken(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function clearSession(response: NextResponse) {
  response.cookies.set(FIREBASE_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  response.cookies.set(ACTIVE_SCHOOL_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ code: 'invalid_origin', detail: 'Sign-in origin was rejected.' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const idToken = typeof body.idToken === 'string' ? body.idToken : '';
  const suppliedCsrf = typeof body.csrfToken === 'string' ? body.csrfToken : '';
  const cookieCsrf = request.cookies.get(FIREBASE_CSRF_COOKIE)?.value ?? '';
  if (!idToken || !suppliedCsrf || !cookieCsrf || !equalToken(suppliedCsrf, cookieCsrf)) {
    return NextResponse.json({ code: 'invalid_csrf', detail: 'Sign-in verification expired. Please try again.' }, { status: 403 });
  }

  try {
    const firebase = getFirebaseAdminAuth();
    const decoded = await firebase.verifyIdToken(idToken, true);
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.auth_time || now - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ code: 'recent_login_required', detail: 'Sign in again to create a secure session.' }, { status: 401 });
    }
    if (!decoded.email || decoded.email_verified !== true) {
      return NextResponse.json({ code: 'email_not_verified', detail: 'Verify your email address before signing in.' }, { status: 403 });
    }
    const sessionCookie = await firebase.createSessionCookie(idToken, {
      expiresIn: FIREBASE_SESSION_MAX_AGE * 1000,
    });
    const response = NextResponse.json({
      email: decoded.email,
      displayName: typeof decoded.name === 'string' ? decoded.name : null,
    });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: FIREBASE_SESSION_MAX_AGE,
    });
    response.cookies.set(FIREBASE_CSRF_COOKIE, '', {
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: new Date(0),
    });
    response.cookies.set(ACTIVE_SCHOOL_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : 'firebase_admin_session_failed';
    console.error('Firebase session creation failed', { code });
    return NextResponse.json({ code: 'invalid_session', detail: 'Sign-in could not be verified.' }, { status: 401 });
  }
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return NextResponse.json({ detail: 'Sign in required' }, { status: 401 });
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const response = NextResponse.json({
      email: decoded.email ?? null,
      displayName: typeof decoded.name === 'string' ? decoded.name : null,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return clearSession(NextResponse.json({ detail: 'Session expired' }, { status: 401 }));
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ detail: 'Sign-out origin was rejected.' }, { status: 403 });
  }
  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
  const body = await request.json().catch(() => ({}));
  if (sessionCookie && body.revokeAll === true) {
    try {
      const firebase = getFirebaseAdminAuth();
      const decoded = await firebase.verifySessionCookie(sessionCookie);
      await firebase.revokeRefreshTokens(decoded.uid);
    } catch {
      // Clearing the local cookie is still safe when the old session cannot be decoded.
    }
  }
  return clearSession(NextResponse.json({ signedOut: true }));
}
