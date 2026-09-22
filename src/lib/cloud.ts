/**
 * Optional Google sign-in + cloud sync via Firebase (Auth + Firestore).
 *
 * Only listening state is synced (positions, favorites, finished flags,
 * bookmarks) — never audio files. The Firebase SDK is loaded on demand, so
 * the app stays fully offline and server-free when this is not configured.
 */
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { RemoteData } from './sync';
import type { GoogleLink } from './types';
import { lsGet, lsSet } from './settings';

const CONFIG_KEY = 'shruti.firebaseConfig';

function envConfig(): FirebaseOptions | null {
  const env = import.meta.env;
  if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_PROJECT_ID) return null;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

/** Config baked in at build time, else one pasted in Settings. */
export function getCloudConfig(): FirebaseOptions | null {
  return envConfig() ?? lsGet<FirebaseOptions | null>(CONFIG_KEY, null);
}

export function isCloudConfigBuiltIn() {
  return envConfig() != null;
}

/**
 * Accepts the snippet Firebase console shows (`const firebaseConfig = {...}`)
 * or plain JSON. Returns an error message, or null on success.
 */
export function setCloudConfig(text: string | null): string | null {
  if (text == null || !text.trim()) {
    lsSet(CONFIG_KEY, undefined);
    resetApp();
    return null;
  }
  const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let parsed: Record<string, unknown>;
  try {
    // Allow the JS-object form: quote bare keys and turn single quotes into double quotes.
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
  resetApp();
  return null;
}

let appPromise: Promise<FirebaseApp> | null = null;

function resetApp() {
  appPromise = null;
}

async function app(): Promise<FirebaseApp> {
  const config = getCloudConfig();
  if (!config) throw new Error('Cloud sync is not configured');
  appPromise ??= import('firebase/app').then(({ initializeApp, getApps }) => getApps()[0] ?? initializeApp(config));
  return appPromise;
}

export async function signInWithGoogle(): Promise<GoogleLink> {
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const auth = getAuth(await app());
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, provider);
  return { uid: user.uid, email: user.email, name: user.displayName, photoURL: user.photoURL };
}

export async function signOutGoogle() {
  const { getAuth, signOut } = await import('firebase/auth');
  await signOut(getAuth(await app()));
}

/** Resolves once Firebase has restored its session; throws if `uid` is no longer signed in. */
async function requireUser(uid: string) {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth(await app());
  await auth.authStateReady();
  if (auth.currentUser?.uid !== uid) throw Object.assign(new Error('Signed out of Google'), { code: 'signed-out' });
}

export async function pullRemote(uid: string): Promise<RemoteData | null> {
  await requireUser(uid);
  const { getFirestore, doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(getFirestore(await app()), 'users', uid));
  return snap.exists() ? (snap.data() as RemoteData) : null;
}

export async function pushRemote(uid: string, data: RemoteData) {
  await requireUser(uid);
  const { getFirestore, doc, setDoc } = await import('firebase/firestore');
  // Firestore rejects `undefined`; a JSON round-trip drops those fields.
  await setDoc(doc(getFirestore(await app()), 'users', uid), JSON.parse(JSON.stringify(data)));
}

export function describeCloudError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  if (code === 'auth/popup-blocked') return 'পপ-আপ আটকে গেছে · The sign-in popup was blocked. Allow popups for this site and try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'সাইন-ইন বাতিল হয়েছে · Sign-in was cancelled.';
  if (code === 'auth/unauthorized-domain') return 'এই ডোমেন Firebase-এ যোগ করা নেই · Add this site’s domain under Firebase → Authentication → Settings → Authorized domains.';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'নেট সংযোগ নেই · No internet connection. Will retry later.';
  if (code === 'permission-denied') return 'Firestore অনুমতি দিচ্ছে না · Firestore denied access. Check the security rules in the README.';
  if (code === 'signed-out') return 'Google থেকে সাইন-আউট হয়ে গেছে · Signed out of Google. Sign in again to sync.';
  return (e as Error)?.message || 'Sync failed';
}
