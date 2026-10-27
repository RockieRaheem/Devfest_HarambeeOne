import { NextResponse } from 'next/server';
import { authorizedBackendFetch } from '@/lib/api/server';

const ACTIVE_SCHOOL_COOKIE = 'harambee-school-id';

async function forward(path: string, init: RequestInit = {}) {
  const response = await authorizedBackendFetch(path, init);
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {'Content-Type': response.headers.get('Content-Type') ?? 'application/json'},
  });
}

export async function GET() {
  let backendResponse = await authorizedBackendFetch('/api/v1/me/context');
  if (backendResponse.status === 403) {
    backendResponse = await authorizedBackendFetch(
      '/api/v1/me/context',
      {},
      { includeActiveSchool: false },
    );
  }
  const body = await backendResponse.text();
  const response = new NextResponse(body, {
    status: backendResponse.status,
    headers: {'Content-Type': backendResponse.headers.get('Content-Type') ?? 'application/json'},
  });
  if (backendResponse.ok) {
    const school = JSON.parse(body) as { id?: string };
    if (school.id && /^[0-9a-f-]{36}$/i.test(school.id)) {
      response.cookies.set(ACTIVE_SCHOOL_COOKIE, school.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }
  return response;
}

export async function POST(request: Request) {
  const created = await authorizedBackendFetch('/api/v1/onboarding/school', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:await request.text(),
  });
  if (!created.ok) {
    return new NextResponse(await created.text(), {
      status: created.status,
      headers: {'Content-Type': created.headers.get('Content-Type') ?? 'application/json'},
    });
  }
  const school = await created.json().catch(() => null) as { id?: string } | null;
  if (!school?.id || !/^[0-9a-f-]{36}$/i.test(school.id)) {
    return NextResponse.json({ detail: 'Institution setup returned an invalid workspace.' }, { status: 502 });
  }
  const response = await forward('/api/v1/me/context', {
    headers: { 'X-School-ID': school.id },
  });
  if (response.ok) {
    response.cookies.set(ACTIVE_SCHOOL_COOKIE, school.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
