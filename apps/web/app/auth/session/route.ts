import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { backendApiOrigin } from '@/lib/api/server';
import {
  FIREBASE_CSRF_COOKIE,
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE,
} from '@/lib/firebase/cookies';

export const runtime = 'nodejs';

const ACTIVE_SCHOOL_COOKIE = 'harambee-school-id';

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  if (!origin || !host || !protocol) return false;
  try {
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

async function sessionBroker(path: string, body: Record<string, string>) {
  return fetch(new URL(`/api/v1/auth/sessions${path}`, backendApiOrigin()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

async function brokerError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return typeof body.detail === 'string' ? body.detail : 'Sign-in could not be verified.';
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
    const broker = await sessionBroker('', { id_token: idToken });
    if (!broker.ok) {
      return NextResponse.json(
        {
          code: broker.status === 503 ? 'auth_unavailable' : 'invalid_session',
          detail: await brokerError(broker),
        },
        { status: broker.status === 403 ? 403 : broker.status === 503 ? 503 : 401 },
      );
    }
    const decoded = await broker.json() as {
      session_cookie: string;
      email: string;
      display_name: string | null;
    };
    const response = NextResponse.json({
      email: decoded.email,
      displayName: decoded.display_name,
    });
    response.cookies.set(FIREBASE_SESSION_COOKIE, decoded.session_cookie, {
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
    const broker = await sessionBroker('/verify', { session_cookie: sessionCookie });
    if (!broker.ok) {
      if (broker.status === 503) {
        return NextResponse.json({ detail: await brokerError(broker) }, { status: 503 });
      }
      return clearSession(NextResponse.json({ detail: 'Session expired' }, { status: 401 }));
    }
    const decoded = await broker.json() as {
      email: string | null;
      display_name: string | null;
    };
    const response = NextResponse.json({
      email: decoded.email,
      displayName: decoded.display_name,
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
      await sessionBroker('/revoke', { session_cookie: sessionCookie });
    } catch {
      // Clearing the local cookie is still safe when the old session cannot be decoded.
    }
  }
  return clearSession(NextResponse.json({ signedOut: true }));
}
