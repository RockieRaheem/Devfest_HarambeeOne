import 'server-only';

import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function adminApp() {
  const existing = getApps().find(app => app.name === 'harambeeone-auth');
  if (existing) return getApp('harambeeone-auth');

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not configured');
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  return initializeApp(
    emulator ? { projectId } : { projectId, credential: applicationDefault() },
    'harambeeone-auth',
  );
}

export function getFirebaseAdminAuth() {
  return getAuth(adminApp());
}
