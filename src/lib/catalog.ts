/**
 * The online story catalogue (Firestore `tracks`) and its files (Storage),
 * plus the admin-only operations: upload, edit, publish, delete, users, admins.
 */
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { firebase } from './firebase';
import type { Id3Tags } from './id3';
import type { Chapter } from './types';

export interface CatalogTrack {
  id: string;
  title: string;
  album: string | null;
  artist: string | null;
  trackNo: number | null;
  duration: number | null;
  sizeBytes: number;
  genres: string[];
  chapters: Chapter[];
  mimeType: string;
  fileName: string;
  /** Path inside the admin's folder at upload time, used to skip duplicates. */
  sourcePath: string;
  audioPath: string;
  coverPath: string | null;
  coverUrl: string | null;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

function fb() {
  const f = firebase();
  if (!f) throw new Error('Firebase is not configured');
  return f;
}

const millis = (t: unknown) => ((t as Timestamp | null)?.toMillis?.() ?? (typeof t === 'number' ? t : Date.now()));

function fromDoc(id: string, d: Record<string, unknown>): CatalogTrack {
  return {
    id,
    title: String(d.title ?? ''),
    album: (d.album as string) ?? null,
    artist: (d.artist as string) ?? null,
    trackNo: typeof d.trackNo === 'number' ? d.trackNo : null,
    duration: typeof d.duration === 'number' ? d.duration : null,
    sizeBytes: Number(d.sizeBytes ?? 0),
    genres: Array.isArray(d.genres) ? (d.genres as string[]) : [],
    chapters: Array.isArray(d.chapters) ? (d.chapters as Chapter[]) : [],
    mimeType: String(d.mimeType ?? 'audio/mpeg'),
    fileName: String(d.fileName ?? ''),
    sourcePath: String(d.sourcePath ?? d.fileName ?? ''),
    audioPath: String(d.audioPath ?? ''),
    coverPath: (d.coverPath as string) ?? null,
    coverUrl: (d.coverUrl as string) ?? null,
    published: d.published === true,
    createdAt: millis(d.createdAt),
    updatedAt: millis(d.updatedAt),
  };
}

/** Live catalogue: admins see everything, listeners only published stories. */
export function subscribeCatalog(isAdmin: boolean, onData: (tracks: CatalogTrack[]) => void, onError: (e: unknown) => void) {
  const { db } = fb();
  const col = collection(db, 'tracks');
  const q = isAdmin ? query(col) : query(col, where('published', '==', true));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    onError,
  );
}

const urlCache = new Map<string, Promise<string>>();

/** A streamable URL for a track's audio (asks Storage, which checks the listener is signed in). */
export function audioUrl(path: string): Promise<string> {
  let p = urlCache.get(path);
  if (!p) {
    p = getDownloadURL(ref(fb().storage, path));
    urlCache.set(path, p);
    p.catch(() => urlCache.delete(path));
  }
  return p;
}

/* ------------------------------------------------------------ admin: upload */

export interface UploadInput {
  file: File;
  sourcePath: string;
  tags: Id3Tags;
  title: string;
  trackNo: number | null;
  genres: string[];
  chapters: Chapter[];
  duration: number | null;
  mimeType: string;
  published: boolean;
}

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'audio';

/** Upload one story: audio (resumable, with progress), cover if embedded, then its catalogue entry. */
export async function uploadTrack(input: UploadInput, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<CatalogTrack> {
  const { db, storage } = fb();
  const trackRef = doc(collection(db, 'tracks'));
  const id = trackRef.id;
  const audioPath = `audio/${id}/${safeName(input.file.name)}`;

  const task = uploadBytesResumable(ref(storage, audioPath), input.file, { contentType: input.mimeType, cacheControl: 'public, max-age=31536000' });
  const onAbort = () => task.cancel();
  signal?.addEventListener('abort', onAbort);
  try {
    await new Promise<void>((resolve, reject) => {
      task.on('state_changed', (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve());
    });
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  let coverPath: string | null = null;
  let coverUrl: string | null = null;
  const pic = input.tags.picture;
  if (pic) {
    const ext = pic.mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    coverPath = `covers/${id}.${ext}`;
    const coverRef = ref(storage, coverPath);
    await new Promise<void>((resolve, reject) => {
      uploadBytesResumable(coverRef, pic.data, { contentType: pic.mime, cacheControl: 'public, max-age=31536000' }).on('state_changed', undefined, reject, () => resolve());
    });
    coverUrl = await getDownloadURL(coverRef);
  }

  const data = {
    title: input.title,
    album: input.tags.album ?? null,
    artist: input.tags.artist ?? input.tags.albumArtist ?? null,
    trackNo: input.trackNo,
    duration: input.duration,
    sizeBytes: input.file.size,
    genres: input.genres,
    chapters: input.chapters,
    mimeType: input.mimeType,
    fileName: input.file.name,
    sourcePath: input.sourcePath,
    audioPath,
    coverPath,
    coverUrl,
    published: input.published,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(trackRef, data);
  return fromDoc(id, { ...data, createdAt: Date.now(), updatedAt: Date.now() });
}

/* -------------------------------------------------------------- admin: edit */

export type TrackPatch = Partial<Pick<CatalogTrack, 'title' | 'album' | 'artist' | 'trackNo' | 'genres' | 'published' | 'duration'>>;

export function updateTrack(id: string, patch: TrackPatch) {
  return updateDoc(doc(fb().db, 'tracks', id), { ...patch, updatedAt: serverTimestamp() });
}

/** Removes the audio file, the cover and the catalogue entry. */
export async function deleteTrack(t: Pick<CatalogTrack, 'id' | 'audioPath' | 'coverPath'>) {
  const { db, storage } = fb();
  const gone = (e: unknown) => ((e as { code?: string }).code === 'storage/object-not-found' ? undefined : Promise.reject(e));
  if (t.audioPath) await deleteObject(ref(storage, t.audioPath)).catch(gone);
  if (t.coverPath) await deleteObject(ref(storage, t.coverPath)).catch(gone);
  await deleteDoc(doc(db, 'tracks', t.id));
}

/* ------------------------------------------------------- users, admins, owner */

export interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
}

/** Create or refresh the signed-in listener's profile document. */
export async function touchUser(u: AppUser) {
  const { db } = fb();
  const r = doc(db, 'users', u.uid);
  const existing = await getDoc(r).catch(() => null);
  await setDoc(
    r,
    {
      name: u.name,
      email: u.email,
      photoURL: u.photoURL,
      lastSeen: serverTimestamp(),
      ...(existing?.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export async function isAdmin(uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(fb().db, 'admins', uid))).exists();
  } catch {
    return false;
  }
}

export async function getOwner(): Promise<{ uid: string; email: string | null } | null> {
  try {
    const s = await getDoc(doc(fb().db, 'config', 'owner'));
    return s.exists() ? (s.data() as { uid: string; email: string | null }) : null;
  } catch {
    return null;
  }
}

/** One-time: the first person to do this becomes the owner and first admin. */
export async function claimOwnership(u: AppUser) {
  const { db } = fb();
  const batch = writeBatch(db);
  batch.set(doc(db, 'config', 'owner'), { uid: u.uid, email: u.email, claimedAt: serverTimestamp() });
  batch.set(doc(db, 'admins', u.uid), { email: u.email, name: u.name, addedAt: serverTimestamp(), addedBy: u.uid });
  await batch.commit();
}

export interface AdminEntry {
  uid: string;
  email: string | null;
  name: string | null;
}

export async function listAdmins(): Promise<AdminEntry[]> {
  const snap = await getDocs(collection(fb().db, 'admins'));
  return snap.docs.map((d) => ({ uid: d.id, email: (d.data().email as string) ?? null, name: (d.data().name as string) ?? null }));
}

/** Make an existing listener (found by the email they signed up with) an admin. */
export async function addAdminByEmail(email: string, by: string): Promise<AdminEntry | null> {
  const { db } = fb();
  const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()), limit(1)));
  const snap2 = snap.empty ? await getDocs(query(collection(db, 'users'), where('email', '==', email.trim()), limit(1))) : snap;
  const d = snap2.docs[0];
  if (!d) return null;
  const entry = { uid: d.id, email: (d.data().email as string) ?? null, name: (d.data().name as string) ?? null };
  await setDoc(doc(db, 'admins', d.id), { email: entry.email, name: entry.name, addedAt: serverTimestamp(), addedBy: by });
  return entry;
}

export function removeAdmin(uid: string) {
  return deleteDoc(doc(fb().db, 'admins', uid));
}

export async function countUsers(): Promise<number | null> {
  try {
    return (await getCountFromServer(collection(fb().db, 'users'))).data().count;
  } catch {
    return null;
  }
}

export async function recentUsers(n = 20): Promise<(AppUser & { createdAt: number; lastSeen: number })[]> {
  const snap = await getDocs(query(collection(fb().db, 'users'), orderBy('lastSeen', 'desc'), limit(n)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { uid: d.id, name: String(x.name ?? ''), email: (x.email as string) ?? null, photoURL: (x.photoURL as string) ?? null, createdAt: millis(x.createdAt), lastSeen: millis(x.lastSeen) };
  });
}
