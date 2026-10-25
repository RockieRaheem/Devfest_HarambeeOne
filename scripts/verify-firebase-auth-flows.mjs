import { setTimeout as delay } from 'node:timers/promises';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import {
  confirmPasswordReset,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const projectId = 'demo-harambeeone';
const emulatorOrigin = 'http://127.0.0.1:9099';
const email = `firebase-check-${Date.now()}@example.test`;
const initialPassword = 'Secure12345!';
const replacementPassword = 'Safer67890!';

const clientApp = initializeApp({ apiKey: 'demo-api-key', projectId });
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, emulatorOrigin, { disableWarnings: true });
const adminAuth = getAdminAuth(initializeAdminApp({ projectId }, 'auth-flow-verifier'));

async function oobCode(requestType, targetEmail) {
  const response = await fetch(`${emulatorOrigin}/emulator/v1/projects/${projectId}/oobCodes`);
  if (!response.ok) throw new Error(`Could not inspect emulator action codes: ${response.status}`);
  const body = await response.json();
  const row = [...(body.oobCodes ?? [])]
    .reverse()
    .find(item => item.requestType === requestType && item.email === targetEmail);
  if (!row?.oobCode) throw new Error(`Missing ${requestType} action code`);
  return row.oobCode;
}

try {
  const created = await createUserWithEmailAndPassword(clientAuth, email, initialPassword);
  await sendEmailVerification(created.user);
  const verificationCode = await oobCode('VERIFY_EMAIL', email);
  const verifyResponse = await fetch(
    `${emulatorOrigin}/emulator/action?mode=verifyEmail&oobCode=${encodeURIComponent(verificationCode)}&apiKey=demo-api-key`,
  );
  if (!verifyResponse.ok) throw new Error('Email verification action failed');

  await signOut(clientAuth);
  const signedIn = await signInWithEmailAndPassword(clientAuth, email, initialPassword);
  if (!signedIn.user.emailVerified) throw new Error('Verified email state was not refreshed');
  const idToken = await signedIn.user.getIdToken(true);
  const decodedIdToken = await adminAuth.verifyIdToken(idToken, true);
  if (decodedIdToken.email !== email) throw new Error('Admin ID-token verification changed identity');

  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: 60 * 60 * 1000 });
  const decodedSession = await adminAuth.verifySessionCookie(sessionCookie, true);
  if (decodedSession.uid !== signedIn.user.uid) throw new Error('Session cookie changed identity');

  await sendPasswordResetEmail(clientAuth, email);
  const resetCode = await oobCode('PASSWORD_RESET', email);
  await confirmPasswordReset(clientAuth, resetCode, replacementPassword);
  await signOut(clientAuth);
  await signInWithEmailAndPassword(clientAuth, email, replacementPassword);

  const googleEmail = `google-check-${Date.now()}@example.test`;
  const googleCredential = GoogleAuthProvider.credential(JSON.stringify({
    sub: `google-${Date.now()}`,
    email: googleEmail,
    email_verified: true,
  }));
  const googleUser = await signInWithCredential(clientAuth, googleCredential);
  if (!googleUser.user.providerData.some(provider => provider.providerId === 'google.com')) {
    throw new Error('Google provider identity was not retained');
  }

  await adminAuth.updateUser(created.user.uid, { disabled: true });
  await signOut(clientAuth);
  await signInWithEmailAndPassword(clientAuth, email, replacementPassword)
    .then(() => { throw new Error('Disabled user was able to sign in'); })
    .catch(error => {
      if (error?.code !== 'auth/user-disabled') throw error;
    });
  await adminAuth.updateUser(created.user.uid, { disabled: false });

  await delay(1100);
  await adminAuth.revokeRefreshTokens(created.user.uid);
  await adminAuth.verifySessionCookie(sessionCookie, true)
    .then(() => { throw new Error('Revoked session cookie was accepted'); })
    .catch(error => {
      if (error?.code !== 'auth/session-cookie-revoked') throw error;
    });

  console.log('Firebase email, verification, recovery, Google, session, disabled-user, and revocation flows passed.');
} finally {
  await fetch(`${emulatorOrigin}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
}
