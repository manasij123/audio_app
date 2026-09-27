/**
 * Shared Firebase setup: Auth (login), Firestore (catalogue + listener data)
 * and Storage (audio + covers). Config comes from the build (.env) or, for a
 * first-time setup, from a config pasted on the setup screen.
 */
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { lsGet, lsSet } from './settings';

const CONFIG_KEY = 'shruti.firebaseConfig';

function envConfig(): FirebaseOptions | null {
  const env = import.meta.env;
  if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_PROJECT_ID) return null;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

/** Local development/testing against `firebase emulators:start`. */
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

export function getFirebaseConfig(): FirebaseOptions | null {
  return envConfig() ?? lsGet<FirebaseOptions | null>(CONFIG_KEY, null);
}

export function isConfigBuiltIn() {
  return envConfig() != null;
}

/**
 * Accepts the snippet the Firebase console shows (`const firebaseConfig = {...}`)
 * or plain JSON. Returns an error message, or null on success.
 */
export function saveFirebaseConfig(text: string | null): string | null {
  if (text == null || !text.trim()) {
    lsSet(CONFIG_KEY, undefined);
    return null;
  }
  const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(
      body
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
        .replace(/'([^']*)'/g, '"$1"')
        .replace(/,\s*}/g, '}'),
    );
  } catch {
    return 'কনফিগ পড়া গেল না · Could not read that config. Paste the firebaseConfig object from the Firebase console.';
  }
  if (typeof parsed.apiKey !== 'string' || typeof parsed.projectId !== 'string') {
    return 'apiKey আর projectId দরকার · The config needs at least apiKey and projectId.';
  }
  lsSet(CONFIG_KEY, parsed);
  return null;
}

export interface Fb {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

let fb: Fb | null = null;

/** The initialised Firebase services, or null when no config is available yet. */
export function firebase(): Fb | null {
  if (fb) return fb;
  const config = getFirebaseConfig();
  if (!config) return null;
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  let db: Firestore;
  try {
    // Keeps the catalogue and your listening data readable when briefly offline.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }
  const storage = getStorage(app);
  if (USE_EMULATORS) {
    const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectStorageEmulator(storage, host, 9199);
  }
  fb = { app, auth, db, storage };
  return fb;
}

function must(): Fb {
  const f = firebase();
  if (!f) throw new Error('Firebase is not configured');
  return f;
}

/* ------------------------------------------------------------------ auth */

export function onUser(cb: (user: User | null) => void) {
  return onAuthStateChanged(must().auth, cb);
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(must().auth, provider);
}

export async function signInEmail(email: string, password: string) {
  return signInWithEmailAndPassword(must().auth, email.trim(), password);
}

export async function signUpEmail(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(must().auth, email.trim(), password);
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
  return cred;
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(must().auth, email.trim());
}

export async function logOut() {
  return signOut(must().auth);
}

export function describeAuthError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'ইমেলটা ঠিক নয় · That email address isn’t valid.';
    case 'auth/missing-password':
    case 'auth/weak-password':
      return 'পাসওয়ার্ড অন্তত ৬ অক্ষরের দিন · Use a password of at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'এই ইমেলে আগেই অ্যাকাউন্ট আছে, লগইন করুন · An account with this email already exists — log in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'ইমেল বা পাসওয়ার্ড মিলছে না · Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'অনেকবার চেষ্টা হয়েছে, একটু পরে আবার চেষ্টা করুন · Too many attempts. Try again in a little while.';
    case 'auth/popup-blocked':
      return 'পপ-আপ আটকে গেছে · The Google sign-in popup was blocked. Allow popups for this site.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'সাইন-ইন বাতিল হয়েছে · Sign-in was cancelled.';
    case 'auth/unauthorized-domain':
      return 'এই ডোমেন Firebase-এ যোগ করা নেই · Add this site’s domain under Firebase → Authentication → Settings → Authorized domains.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'নেট সংযোগ নেই · No internet connection.';
    case 'permission-denied':
      return 'অনুমতি নেই · Permission denied by the server’s security rules.';
    default:
      return (e as Error)?.message || 'কিছু একটা গোলমাল হয়েছে · Something went wrong.';
  }
}
