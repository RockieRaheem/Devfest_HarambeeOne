export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function required(name: string, value: string | undefined) {
  if (!value?.trim()) throw new Error(`${name} is not configured`);
  return value.trim();
}

export function getFirebaseClientConfig(): FirebaseClientConfig {
  return {
    apiKey: required('NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: required(
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: required(
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: required(
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: required('NEXT_PUBLIC_FIREBASE_APP_ID', process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

export function firebaseAuthEmulatorUrl() {
  const value = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?.trim();
  if (!value) return null;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Firebase Auth emulator must not be configured in production');
  }
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Firebase Auth emulator must use a loopback host');
  }
  return url.origin;
}

export function getFirebaseVapidKey() {
  return required(
    'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  );
}
