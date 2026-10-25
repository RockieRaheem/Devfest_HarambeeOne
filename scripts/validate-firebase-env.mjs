import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = realpathSync(dirname(fileURLToPath(new URL('../package.json', import.meta.url))));
const emulatorMode = process.argv.includes('--emulator');
const envPath = resolve(repositoryRoot, '.env');

const allowedFromEnvFile = new Set([
  'FIREBASE_PROJECT_ID',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'AUTH_PROVIDER',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
]);

function loadRootEnv() {
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || !allowedFromEnvFile.has(match[1]) || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2');
  }
}

function isPlaceholder(value) {
  return /^(?:demo-|replace|your_|project_|0{6,}|1:0{6,}:)/i.test(value);
}

function requireValue(name, errors) {
  const value = process.env[name]?.trim();
  if (!value) {
    errors.push(`${name} is required.`);
    return '';
  }
  if (!emulatorMode && isPlaceholder(value)) errors.push(`${name} still contains a placeholder value.`);
  return value;
}

loadRootEnv();

if (emulatorMode) {
  const emulatorDefaults = {
    FIREBASE_PROJECT_ID: 'demo-harambeeone',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    AUTH_PROVIDER: 'firebase',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-harambeeone.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-harambeeone',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-harambeeone.firebasestorage.app',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: 'demo-vapid-public-key',
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: 'http://127.0.0.1:9099',
  };
  for (const [name, value] of Object.entries(emulatorDefaults)) process.env[name] ||= value;
}

const errors = [];
const publicNames = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
];

const values = Object.fromEntries(publicNames.map((name) => [name, requireValue(name, errors)]));
const serverProjectId = requireValue('FIREBASE_PROJECT_ID', errors);
if (process.env.AUTH_PROVIDER?.trim() !== 'firebase') {
  errors.push('AUTH_PROVIDER must be firebase for the migrated runtime.');
}
if (!emulatorMode && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST)) {
  errors.push('Firebase Auth emulator hosts must be unset outside emulator mode.');
}

if (values.NEXT_PUBLIC_FIREBASE_PROJECT_ID && serverProjectId && values.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== serverProjectId) {
  errors.push('Client and server Firebase project IDs must match.');
}

for (const forbidden of [
  'NEXT_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS',
  'NEXT_PUBLIC_FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
]) {
  if (process.env[forbidden]?.trim()) errors.push(`${forbidden} is forbidden; use server-only Application Default Credentials.`);
}

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
if (!emulatorMode && credentialPath) {
  const resolvedCredentialPath = resolve(repositoryRoot, credentialPath);
  if (!isAbsolute(credentialPath)) errors.push('GOOGLE_APPLICATION_CREDENTIALS must be an absolute path outside the repository.');
  if (existsSync(resolvedCredentialPath)) {
    const canonicalCredentialPath = realpathSync(resolvedCredentialPath);
    const pathFromRepository = relative(repositoryRoot, canonicalCredentialPath);
    if (!pathFromRepository.startsWith('..') && !isAbsolute(pathFromRepository)) {
      errors.push('GOOGLE_APPLICATION_CREDENTIALS must not point inside the repository.');
    }
  } else {
    errors.push('GOOGLE_APPLICATION_CREDENTIALS does not point to an existing file.');
  }
}

if (errors.length) {
  console.error(`Firebase environment validation failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Firebase environment is valid for ${emulatorMode ? 'local emulators' : 'server-side ADC discovery'}.`);
