import type { NextRequest } from 'next/server';
import { updateFirebaseSession } from '@/lib/firebase/middleware';

export function middleware(request: NextRequest) {
  return updateFirebaseSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|harambeeone-logo.png|favicon.ico|api/health).*)'],
};
