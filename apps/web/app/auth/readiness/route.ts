import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getFirebaseAdminAuth().listUsers(1);
    return NextResponse.json(
      { ok: true, service: 'firebase-admin-auth' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : 'firebase_admin_unavailable';
    console.error('Firebase Admin readiness failed', { code });
    return NextResponse.json(
      { ok: false, service: 'firebase-admin-auth', code },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
