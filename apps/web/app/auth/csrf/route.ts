import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { FIREBASE_CSRF_COOKIE } from '@/lib/firebase/cookies';

export const runtime = 'nodejs';

export async function GET() {
  const token = randomBytes(32).toString('base64url');
  const response = NextResponse.json({ token });
  response.cookies.set(FIREBASE_CSRF_COOKIE, token, {
    httpOnly: false,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 300,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
