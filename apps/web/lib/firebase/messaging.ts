'use client';

import {
  getMessaging,
  isSupported,
  onMessage,
  onRegistered,
  onUnregistered,
  register as registerMessaging,
  unregister,
  type Messaging,
} from 'firebase/messaging';
import { clientFetch } from '@/lib/api/client';
import { getFirebaseClientApp } from './client';
import { getFirebaseVapidKey } from './config';

export type PushState = 'checking' | 'unsupported' | 'prompt' | 'enabled' | 'denied' | 'error';

let messagingInstance: Messaging | null = null;
let currentFid: string | null = null;
let registrationSync: Promise<void> | null = null;
let listenersInstalled = false;
const CONSENT_KEY = 'harambee:push-consent';
const FID_KEY = 'harambee:push-fid';

function safeProviderError(error: unknown) {
  if (!(error instanceof Error)) return '';
  const name = error.name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  const message = error.message
    .replace(/https?:\/\/\S+/g, '[provider endpoint]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .replace(/[^a-zA-Z0-9 .,()_:/-]/g, '')
    .trim()
    .slice(0, 180);
  return [name, message].filter(Boolean).join(': ');
}

async function postInstallation(fid: string) {
  const label = `${navigator.platform || 'Browser'} · ${navigator.userAgent.split(' ')[0]}`.slice(
    0,
    100,
  );
  const response = await clientFetch('/api/backend/api/v1/push/installations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installation_id: fid, target_kind: 'fid', device_label: label }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(
      body.detail || `The signed-in push registration failed (HTTP ${response.status}).`,
    );
  }
}

async function revokeInstallation(fid: string) {
  await clientFetch('/api/backend/api/v1/push/installations/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installation_id: fid }),
  });
}

async function prepareMessaging() {
  if (!(await isSupported()) || !('serviceWorker' in navigator)) return null;
  let serviceWorkerRegistration: ServiceWorkerRegistration;
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' },
    );
  } catch {
    throw new Error('The notification service worker could not be started.');
  }
  const messaging = getMessaging(getFirebaseClientApp());
  if (!listenersInstalled) {
    onRegistered(messaging, fid => {
      currentFid = fid;
      localStorage.setItem(FID_KEY, fid);
      registrationSync = postInstallation(fid).catch(error => {
        window.dispatchEvent(new CustomEvent('harambee:push-error'));
        throw error;
      });
    });
    onUnregistered(messaging, fid => {
      if (currentFid === fid) currentFid = null;
      registrationSync = null;
      localStorage.removeItem(CONSENT_KEY);
      if (localStorage.getItem(FID_KEY) === fid) localStorage.removeItem(FID_KEY);
      void revokeInstallation(fid).catch(() => undefined);
    });
    onMessage(messaging, payload => {
      window.dispatchEvent(new CustomEvent('harambee:push', { detail: payload.data ?? {} }));
    });
    listenersInstalled = true;
  }
  messagingInstance = messaging;
  return { messaging, serviceWorkerRegistration };
}

async function awaitInstallationSync(): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!currentFid || !registrationSync) {
    if (Date.now() >= deadline) throw new Error('Firebase registration timed out.');
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }
  await registrationSync;
}

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined' || !(await isSupported())) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted' || localStorage.getItem(CONSENT_KEY) !== 'enabled') return 'prompt';
  try {
    const prepared = await prepareMessaging();
    if (!prepared) return 'unsupported';
    await registerMessaging(prepared.messaging, {
      vapidKey: getFirebaseVapidKey(),
      serviceWorkerRegistration: prepared.serviceWorkerRegistration,
    });
    await awaitInstallationSync();
    return 'enabled';
  } catch {
    return 'error';
  }
}

export async function enablePush(): Promise<PushState> {
  const prepared = await prepareMessaging();
  if (!prepared) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'prompt';
  try {
    await registerMessaging(prepared.messaging, {
      vapidKey: getFirebaseVapidKey(),
      serviceWorkerRegistration: prepared.serviceWorkerRegistration,
    });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String(error.code).replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 80)
      : '';
    const providerError = safeProviderError(error);
    throw new Error(code
      ? `Firebase could not register this browser (${code}).`
      : providerError
        ? `Firebase could not register this browser: ${providerError}`
        : 'Firebase could not register this browser.');
  }
  await awaitInstallationSync();
  localStorage.setItem(CONSENT_KEY, 'enabled');
  return 'enabled';
}

export async function disablePush(allDevices = false): Promise<PushState> {
  localStorage.removeItem(CONSENT_KEY);
  const fid = currentFid ?? localStorage.getItem(FID_KEY);
  if (fid) await revokeInstallation(fid);
  if (!messagingInstance && fid) await prepareMessaging().catch(() => null);
  if (messagingInstance) await unregister(messagingInstance).catch(() => undefined);
  if (allDevices) {
    await clientFetch('/api/backend/api/v1/push/disable-all', { method: 'POST' });
  }
  currentFid = null;
  registrationSync = null;
  localStorage.removeItem(FID_KEY);
  return 'prompt';
}
