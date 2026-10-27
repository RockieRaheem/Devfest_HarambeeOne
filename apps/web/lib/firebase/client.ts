'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseAuthEmulatorUrl, getFirebaseClientConfig } from './config';

let emulatorConnected = false;
let persistenceReady: Promise<void> | undefined;

export function getFirebaseClientApp() {
  return getApps().length ? getApp() : initializeApp(getFirebaseClientConfig());
}

export function getFirebaseAuth() {
  const app = getFirebaseClientApp();
  const auth = getAuth(app);
  const emulatorUrl = firebaseAuthEmulatorUrl();
  if (emulatorUrl && !emulatorConnected) {
    connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
    emulatorConnected = true;
  }
  persistenceReady ??= setPersistence(auth, browserLocalPersistence);
  return auth;
}

export async function prepareFirebaseAuth() {
  const auth = getFirebaseAuth();
  await persistenceReady;
  return auth;
}

export async function establishServerSession(user: User) {
  const csrfResponse = await fetch('/auth/csrf', { cache: 'no-store' });
  const csrfBody = await csrfResponse.json();
  if (!csrfResponse.ok || typeof csrfBody.token !== 'string') {
    throw new Error('A secure sign-in session could not be prepared.');
  }
  const idToken = await user.getIdToken(true);
  const response = await fetch('/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, csrfToken: csrfBody.token }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(body.detail || 'A secure session could not be created.'), {
      code: body.code,
    });
  }
  await signOut(getFirebaseAuth());
  return body as { email: string; displayName: string | null };
}

export async function clearServerSession(revokeAll = false) {
  await import('./messaging')
    .then(({ disablePush }) => disablePush())
    .catch(() => undefined);
  await fetch('/auth/session', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revokeAll }),
    cache: 'no-store',
  }).catch(() => undefined);
  await signOut(getFirebaseAuth()).catch(() => undefined);
}
