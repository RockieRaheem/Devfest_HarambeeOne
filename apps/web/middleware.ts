import type { NextRequest } from 'next/server';
import { updateFirebaseSession } from '@/lib/firebase/middleware';

export function middleware(request: NextRequest) {
  return updateFirebaseSession(request);
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|firebase-messaging-sw.js|harambeeone-logo.png|favicon.ico|api/health).*)',
  ],
};
