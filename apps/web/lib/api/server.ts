import { cookies } from 'next/headers';
import { FIREBASE_SESSION_COOKIE } from '@/lib/firebase/cookies';

export function backendApiOrigin() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';
}

export async function authorizedBackendFetch(
  path: string,
  init: RequestInit = {},
  options: { includeActiveSchool?: boolean } = {},
) {
  if (!path.startsWith('/api/v1/')) {
    throw new Error('Only HarambeeOne API routes may be requested');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!token) return Response.json({ detail: 'Sign in required' }, { status: 401 });

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  const activeSchoolId = options.includeActiveSchool === false
    ? undefined
    : cookieStore.get('harambee-school-id')?.value;
  if (activeSchoolId && !headers.has('X-School-ID')) headers.set('X-School-ID', activeSchoolId);
  return fetch(new URL(path, backendApiOrigin()), { ...init, headers, cache: 'no-store' });
}
