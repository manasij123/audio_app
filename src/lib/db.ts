import { normalizeTrack, type Bookmark, type DayStats, type Profile, type Progress, type Track } from './types';

const DB_NAME = 'shruti';
const DB_VERSION = 2;

/* ------------------------------------------------------------------ schema */

type StoreName = 'tracks' | 'covers' | 'audio' | 'progress' | 'bookmarks' | 'stats' | 'profiles';

const SCHEMA: Record<StoreName, { keyPath: string | string[]; indexes?: Record<string, string> }> = {
  tracks: { keyPath: 'id' },
  covers: { keyPath: 'id' },
  audio: { keyPath: 'id' },
  progress: { keyPath: ['profileId', 'trackId'], indexes: { profileId: 'profileId', trackId: 'trackId' } },
  bookmarks: { keyPath: 'id', indexes: { profileId: 'profileId', trackId: 'trackId' } },
  stats: { keyPath: ['profileId', 'day'], indexes: { profileId: 'profileId' } },
  profiles: { keyPath: 'id' },
};

type Key = IDBValidKey;
type Op =
  | { store: StoreName; put: object }
  | { store: StoreName; del: Key }
  | { store: StoreName; delWhere: { index: string; value: Key } };

/** The few primitives the library needs; implemented by IndexedDB and by an in-memory fallback. */
interface Backend {
  readonly mode: 'indexeddb' | 'memory';
  get<T>(store: StoreName, key: Key): Promise<T | undefined>;
  getAll<T>(store: StoreName, where?: { index: string; value: Key }): Promise<T[]>;
  /** Apply all ops atomically. */
  write(ops: Op[]): Promise<void>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction!;
      for (const [name, def] of Object.entries(SCHEMA) as [StoreName, (typeof SCHEMA)[StoreName]][]) {
        const store = db.objectStoreNames.contains(name) ? tx.objectStore(name) : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const [index, path] of Object.entries(def.indexes ?? {})) {
          if (!store.indexNames.contains(index)) store.createIndex(index, path);
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Shruti is open in another tab with an older version. Close that tab and reload.'));
  });
}

class IdbBackend implements Backend {
  readonly mode = 'indexeddb' as const;
  constructor(private db: IDBDatabase) {}

  private tx<T>(stores: StoreName[], mode: IDBTransactionMode, fn: (tx: IDBTransaction, set: (v: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(stores, mode);
      } catch (e) {
        reject(e);
        return;
      }
      let out: T;
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
      try {
        fn(tx, (v) => (out = v));
      } catch (e) {
        try {
          tx.abort();
        } catch {
          /* already finished */
        }
        reject(e);
      }
    });
  }

  get<T>(store: StoreName, key: Key) {
    return this.tx<T | undefined>([store], 'readonly', (tx, set) => {
      const r = tx.objectStore(store).get(key);
      r.onsuccess = () => set(r.result as T | undefined);
    });
  }

  getAll<T>(store: StoreName, where?: { index: string; value: Key }) {
    return this.tx<T[]>([store], 'readonly', (tx, set) => {
      set([]);
      const os = tx.objectStore(store);
      const r = where ? os.index(where.index).getAll(IDBKeyRange.only(where.value)) : os.getAll();
      r.onsuccess = () => set(r.result as T[]);
    });
  }

  write(ops: Op[]) {
    if (!ops.length) return Promise.resolve();
    const stores = [...new Set(ops.map((o) => o.store))];
    return this.tx<void>(stores, 'readwrite', (tx) => {
      for (const op of ops) {
        const os = tx.objectStore(op.store);
        if ('put' in op) os.put(op.put);
        else if ('del' in op) os.delete(op.del);
        else {
          const req = os.index(op.delWhere.index).openKeyCursor(IDBKeyRange.only(op.delWhere.value));
          req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            os.delete(cursor.primaryKey);
            cursor.continue();
          };
        }
      }
    });
  }
}

/** Used when IndexedDB is unavailable (e.g. some private modes): works for this session only. */
class MemoryBackend implements Backend {
  readonly mode = 'memory' as const;
  private data = new Map<StoreName, Map<string, Record<string, unknown>>>();

  private map(store: StoreName) {
    let m = this.data.get(store);
    if (!m) this.data.set(store, (m = new Map()));
    return m;
  }
  private keyOf(store: StoreName, value: Record<string, unknown>) {
    const kp = SCHEMA[store].keyPath;
    return JSON.stringify(Array.isArray(kp) ? kp.map((k) => value[k]) : value[kp]);
  }

  async get<T>(store: StoreName, key: Key) {
    return this.map(store).get(JSON.stringify(key)) as T | undefined;
  }
  async getAll<T>(store: StoreName, where?: { index: string; value: Key }) {
    const all = [...this.map(store).values()];
    if (!where) return all as T[];
    const path = SCHEMA[store].indexes![where.index];
    return all.filter((v) => v[path] === where.value) as T[];
  }
  async write(ops: Op[]) {
    for (const op of ops) {
      const m = this.map(op.store);
      if ('put' in op) m.set(this.keyOf(op.store, op.put as Record<string, unknown>), op.put as Record<string, unknown>);
      else if ('del' in op) m.delete(JSON.stringify(op.del));
      else {
        const path = SCHEMA[op.store].indexes![op.delWhere.index];
        for (const [k, v] of m) if (v[path] === op.delWhere.value) m.delete(k);
      }
    }
  }
}

/* ----------------------------------------------------------------- library */

interface BlobRecord {
  id: string;
  blob: Blob;
}

/** Shared (not per-profile) fields of a track, as stored in `tracks`. */
type TrackMeta = Omit<Track, 'position' | 'favorite' | 'finished' | 'lastPlayedAt'>;

/** Old v1 records also carried `position`/`favorite` directly on the track. */
type StoredTrack = TrackMeta & Partial<Pick<Track, 'position' | 'favorite'>>;

export interface LibraryData {
  tracks: Track[];
  covers: Map<string, Blob>;
  bookmarks: Bookmark[];
  stats: DayStats[];
}

export function isQuotaError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function metaOf(t: Track): TrackMeta {
  return {
    id: t.id,
    title: t.title,
    album: t.album,
    artist: t.artist,
    trackNo: t.trackNo,
    sizeBytes: t.sizeBytes,
    duration: t.duration,
    addedAt: t.addedAt,
    fileName: t.fileName,
    mimeType: t.mimeType,
    hasCover: t.hasCover,
    chapters: t.chapters,
    genres: t.genres,
  };
}

export function progressOf(profileId: string, t: Track, updatedAt = Date.now()): Progress {
  return {
    profileId,
    trackId: t.id,
    position: t.position,
    favorite: t.favorite,
    finished: t.finished,
    lastPlayedAt: t.lastPlayedAt,
    updatedAt,
  };
}

export class LibraryStore {
  constructor(private db: Backend) {}

  get mode() {
    return this.db.mode;
  }

  /* profiles */

  listProfiles() {
    return this.db.getAll<Profile>('profiles');
  }

  /** Saves a profile. The very first profile adopts listening progress stored by v1 of the app. */
  async putProfile(p: Profile) {
    const ops: Op[] = [{ store: 'profiles', put: p }];
    const existing = await this.db.getAll<Profile>('profiles');
    if (existing.length === 0) {
      for (const t of await this.db.getAll<StoredTrack>('tracks')) {
        if (t.position || t.favorite) {
          ops.push({
            store: 'progress',
            put: { profileId: p.id, trackId: t.id, position: t.position ?? 0, favorite: !!t.favorite, finished: false, lastPlayedAt: null, updatedAt: Date.now() } satisfies Progress,
          });
        }
      }
    }
    await this.db.write(ops);
  }

  deleteProfile(id: string) {
    return this.db.write([
      { store: 'profiles', del: id },
      { store: 'progress', delWhere: { index: 'profileId', value: id } },
      { store: 'bookmarks', delWhere: { index: 'profileId', value: id } },
      { store: 'stats', delWhere: { index: 'profileId', value: id } },
    ]);
  }

  /* library */

  async load(profileId: string): Promise<LibraryData> {
    const [metas, covers, progress, bookmarks, stats] = await Promise.all([
      this.db.getAll<StoredTrack>('tracks'),
      this.db.getAll<BlobRecord>('covers'),
      this.db.getAll<Progress>('progress', { index: 'profileId', value: profileId }),
      this.db.getAll<Bookmark>('bookmarks', { index: 'profileId', value: profileId }),
      this.db.getAll<DayStats>('stats', { index: 'profileId', value: profileId }),
    ]);
    const byTrack = new Map(progress.map((p) => [p.trackId, p]));
    const tracks = metas.map((m) => {
      const p = byTrack.get(m.id);
      const { position: _legacyPos, favorite: _legacyFav, ...meta } = m;
      return normalizeTrack({
        ...meta,
        position: p?.position ?? 0,
        favorite: p?.favorite ?? false,
        finished: p?.finished ?? false,
        lastPlayedAt: p?.lastPlayedAt ?? null,
      });
    });
    return { tracks, covers: new Map(covers.map((c) => [c.id, c.blob])), bookmarks, stats };
  }

  add(track: Track, audio: Blob, cover: Blob | null) {
    // Blobs are stored as-is (structured clone) — no base64.
    const ops: Op[] = [
      { store: 'audio', put: { id: track.id, blob: audio } satisfies BlobRecord },
      { store: 'tracks', put: metaOf(track) },
    ];
    if (cover) ops.push({ store: 'covers', put: { id: track.id, blob: cover } satisfies BlobRecord });
    return this.db.write(ops);
  }

  saveMeta(track: Track) {
    return this.db.write([{ store: 'tracks', put: metaOf(track) }]);
  }

  saveProgress(p: Progress) {
    return this.db.write([{ store: 'progress', put: p }]);
  }

  saveProgressMany(list: Progress[]) {
    return this.db.write(list.map((p) => ({ store: 'progress' as const, put: p })));
  }

  getProgress(profileId: string) {
    return this.db.getAll<Progress>('progress', { index: 'profileId', value: profileId });
  }

  async getAudio(id: string) {
    return (await this.db.get<BlobRecord>('audio', id))?.blob ?? null;
  }

  /** Deletes the track, its blobs and every profile's progress and bookmarks for it. */
  remove(id: string) {
    return this.db.write([
      { store: 'tracks', del: id },
      { store: 'covers', del: id },
      { store: 'audio', del: id },
      { store: 'progress', delWhere: { index: 'trackId', value: id } },
      { store: 'bookmarks', delWhere: { index: 'trackId', value: id } },
    ]);
  }

  putBookmarks(list: Bookmark[]) {
    return this.db.write(list.map((b) => ({ store: 'bookmarks' as const, put: b })));
  }

  getBookmarks(profileId: string) {
    return this.db.getAll<Bookmark>('bookmarks', { index: 'profileId', value: profileId });
  }

  putStats(s: DayStats) {
    return this.db.write([{ store: 'stats', put: s }]);
  }
}

export async function openLibraryStore(): Promise<{ store: LibraryStore; error: unknown }> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not supported in this browser');
    const backend = new IdbBackend(await openDatabase());
    await backend.get('audio', '\u0000probe'); // smoke test: some private modes open fine but fail on use
    return { store: new LibraryStore(backend), error: null };
  } catch (error) {
    console.warn('[shruti] persistent storage unavailable, using memory', error);
    return { store: new LibraryStore(new MemoryBackend()), error };
  }
}

/** For tests. */
export function memoryLibraryStore() {
  return new LibraryStore(new MemoryBackend());
}

/* ----------------------------------------------------------- browser quota */

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isPersisted(): Promise<boolean | null> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota) return null;
    return { usage: est.usage ?? 0, quota: est.quota };
  } catch {
    return null;
  }
}
