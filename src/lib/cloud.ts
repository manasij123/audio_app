/**
 * Per-listener sync of listening state (positions, favourites, finished flags,
 * bookmarks) to Firestore `listening/{uid}`, so it follows them across devices.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { describeAuthError, firebase } from './firebase';
import type { RemoteData } from './sync';

export async function pullRemote(uid: string): Promise<RemoteData | null> {
  const f = firebase();
  if (!f) throw new Error('Firebase is not configured');
  const snap = await getDoc(doc(f.db, 'listening', uid));
  return snap.exists() ? (snap.data() as RemoteData) : null;
}

export async function pushRemote(uid: string, data: RemoteData) {
  const f = firebase();
  if (!f) throw new Error('Firebase is not configured');
  // Firestore rejects `undefined`; a JSON round-trip drops those fields.
  await setDoc(doc(f.db, 'listening', uid), JSON.parse(JSON.stringify(data)));
}

export const describeCloudError = describeAuthError;
