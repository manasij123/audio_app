import type { Track } from './types';

const DB_NAME = 'shruti';
const DB_VERSION = 1;

type StoreName = 'tracks' | 'covers' | 'audio';
interface BlobRecord {
  id: string;
  blob: Blob;
}

export interface LibraryStore {
  /** 'indexeddb' persists across reloads; 'memory' is lost on reload. */
  readonly mode: 'indexeddb' | 'memory';
  loadAll(): Promise<{ tracks: Track[]; covers: Map<string, Blob> }>;
  add(track: Track, audio: Blob, cover: Blob | null): Promise<void>;
  saveMeta(track: Track): Promise<void>;
  getAudio(id: string): Promise<Blob | null>;
  remove(id: string): Promise<void>;
}

export function isQuotaError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

/** Only the metadata fields — never let stray UI props leak into the DB. */
function toRecord(t: Track): Track {
  return {
    id: t.id,
    title: t.title,
    album: t.album,
    artist: t.artist,
    trackNo: t.trackNo,
    sizeBytes: t.sizeBytes,
    favorite: t.favorite,
    position: t.position,
    duration: t.duration,
    addedAt: t.addedAt,
    fileName: t.fileName,
    mimeType: t.mimeType,
    hasCover: t.hasCover,
  };
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
      for (const name of ['tracks', 'covers', 'audio'] as StoreName[]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database is blocked by another open tab'));
  });
}

class IdbStore implements LibraryStore {
  readonly mode = 'indexeddb' as const;
  constructor(private db: IDBDatabase) {}

  /** Run `fn` inside a transaction; resolves with whatever `set` received once the tx commits. */
  private run<T>(
    stores: StoreName[],
    mode: IDBTransactionMode,
    fn: (tx: IDBTransaction, set: (v: T) => void) => void,
  ): Promise<T> {
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

  loadAll() {
    return this.run<{ tracks: Track[]; covers: Map<string, Blob> }>(['tracks', 'covers'], 'readonly', (tx, set) => {
      const result = { tracks: [] as Track[], covers: new Map<string, Blob>() };
      const tReq = tx.objectStore('tracks').getAll();
      tReq.onsuccess = () => (result.tracks = tReq.result as Track[]);
      const cReq = tx.objectStore('covers').getAll();
      cReq.onsuccess = () => {
        for (const r of cReq.result as BlobRecord[]) result.covers.set(r.id, r.blob);
      };
      set(result);
    });
  }

  add(track: Track, audio: Blob, cover: Blob | null) {
    return this.run<void>(['tracks', 'covers', 'audio'], 'readwrite', (tx) => {
      // Blobs are stored as-is (structured clone) — no base64.
      tx.objectStore('audio').put({ id: track.id, blob: audio } satisfies BlobRecord);
      if (cover) tx.objectStore('covers').put({ id: track.id, blob: cover } satisfies BlobRecord);
      tx.objectStore('tracks').put(toRecord(track));
    });
  }

  saveMeta(track: Track) {
    return this.run<void>(['tracks'], 'readwrite', (tx) => {
      tx.objectStore('tracks').put(toRecord(track));
    });
  }

  getAudio(id: string) {
    return this.run<Blob | null>(['audio'], 'readonly', (tx, set) => {
      set(null);
      const req = tx.objectStore('audio').get(id);
      req.onsuccess = () => set((req.result as BlobRecord | undefined)?.blob ?? null);
    });
  }

  remove(id: string) {
    return this.run<void>(['tracks', 'covers', 'audio'], 'readwrite', (tx) => {
      for (const name of ['tracks', 'covers', 'audio'] as StoreName[]) tx.objectStore(name).delete(id);
    });
  }
}

/** Fallback when IndexedDB is unavailable (e.g. some private modes): works for this session only. */
class MemoryStore implements LibraryStore {
  readonly mode = 'memory' as const;
  private tracks = new Map<string, Track>();
  private covers = new Map<string, Blob>();
  private audio = new Map<string, Blob>();

  async loadAll() {
    return { tracks: [...this.tracks.values()].map(toRecord), covers: new Map(this.covers) };
  }
  async add(track: Track, audio: Blob, cover: Blob | null) {
    this.audio.set(track.id, audio);
    if (cover) this.covers.set(track.id, cover);
    this.tracks.set(track.id, toRecord(track));
  }
  async saveMeta(track: Track) {
    this.tracks.set(track.id, toRecord(track));
  }
  async getAudio(id: string) {
    return this.audio.get(id) ?? null;
  }
  async remove(id: string) {
    this.tracks.delete(id);
    this.covers.delete(id);
    this.audio.delete(id);
  }
}

export async function openLibraryStore(): Promise<{ store: LibraryStore; error: unknown }> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not supported in this browser');
    const db = await openDatabase();
    const store = new IdbStore(db);
    await store.getAudio('\u0000probe'); // smoke test: some private modes open fine but fail on use
    return { store, error: null };
  } catch (error) {
    console.warn('[shruti] persistent storage unavailable, using memory', error);
    return { store: new MemoryStore(), error };
  }
}

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

export async function freeSpaceBytes(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota) return null;
    return est.quota - (est.usage ?? 0);
  } catch {
    return null;
  }
}
