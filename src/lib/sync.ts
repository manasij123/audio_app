import type { Bookmark, Progress } from './types';

/** Shape of a user's document in the cloud (Firestore `users/{uid}`). */
export interface RemoteData {
  version: 1;
  progress: Record<string, RemoteProgress>;
  bookmarks: Record<string, RemoteBookmark>;
  updatedAt: number;
}

export type RemoteProgress = Omit<Progress, 'profileId' | 'trackId'>;
export type RemoteBookmark = Omit<Bookmark, 'profileId' | 'id'>;

export interface MergeResult {
  /** Records to write locally (only those that changed). */
  localProgress: Progress[];
  localBookmarks: Bookmark[];
  /** Full merged document to upload. */
  remote: RemoteData;
  /** Whether the remote document differs from what was downloaded. */
  remoteChanged: boolean;
}

/** Tombstones older than this are dropped from the cloud document. */
const TOMBSTONE_TTL_MS = 90 * 24 * 3600 * 1000;

/**
 * Last-write-wins merge of one profile's local listening state with the cloud copy.
 * Tracks are matched by id (their path inside the imported folder), so the same
 * folder imported on two devices lines up.
 */
export function mergeSync(profileId: string, local: { progress: Progress[]; bookmarks: Bookmark[] }, remote: RemoteData | null, now = Date.now()): MergeResult {
  const out: RemoteData = { version: 1, progress: {}, bookmarks: {}, updatedAt: now };
  const localProgress: Progress[] = [];
  const localBookmarks: Bookmark[] = [];
  let remoteChanged = remote == null;

  const remoteProgress = remote?.progress ?? {};
  const localById = new Map(local.progress.map((p) => [p.trackId, p]));
  for (const trackId of new Set([...localById.keys(), ...Object.keys(remoteProgress)])) {
    const l = localById.get(trackId);
    const r = remoteProgress[trackId];
    if (r && (!l || r.updatedAt > l.updatedAt)) {
      localProgress.push({ profileId, trackId, ...r });
      out.progress[trackId] = r;
    } else if (l) {
      const { profileId: _p, trackId: _t, ...rest } = l;
      out.progress[trackId] = rest;
      if (!r || l.updatedAt > r.updatedAt) remoteChanged = true;
    }
  }

  const remoteBookmarks = remote?.bookmarks ?? {};
  const localBm = new Map(local.bookmarks.map((b) => [b.id, b]));
  for (const id of new Set([...localBm.keys(), ...Object.keys(remoteBookmarks)])) {
    const l = localBm.get(id);
    const r = remoteBookmarks[id];
    let winner: RemoteBookmark;
    if (r && (!l || r.updatedAt > l.updatedAt)) {
      winner = r;
      localBookmarks.push({ id, profileId, ...r });
    } else {
      const { profileId: _p, id: _i, ...rest } = l!;
      winner = rest;
      if (!r || l!.updatedAt > r.updatedAt) remoteChanged = true;
    }
    if (winner.deleted && now - winner.updatedAt > TOMBSTONE_TTL_MS) {
      if (r) remoteChanged = true;
      continue;
    }
    out.bookmarks[id] = winner;
  }

  if (!remoteChanged && remote) out.updatedAt = remote.updatedAt;
  return { localProgress, localBookmarks, remote: out, remoteChanged };
}
