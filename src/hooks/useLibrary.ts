import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogTrack } from '../lib/catalog';
import { progressOf, type LibraryStore } from '../lib/db';
import type { Bookmark, DayStats, Progress, Track } from '../lib/types';

type ProgressPatch = Partial<Pick<Track, 'position' | 'favorite' | 'finished' | 'lastPlayedAt'>>;

const STATS_FLUSH_MS = 20_000;

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

function toTrack(c: CatalogTrack, p: Progress | undefined): Track {
  return {
    id: c.id,
    title: c.title,
    album: c.album,
    artist: c.artist,
    trackNo: c.trackNo,
    sizeBytes: c.sizeBytes,
    duration: c.duration,
    addedAt: c.createdAt,
    fileName: c.fileName,
    mimeType: c.mimeType,
    hasCover: !!c.coverUrl,
    chapters: c.chapters,
    genres: c.genres,
    audioPath: c.audioPath,
    sourcePath: c.sourcePath,
    coverPath: c.coverPath,
    coverUrl: c.coverUrl,
    published: c.published,
    position: p?.position ?? 0,
    favorite: p?.favorite ?? false,
    finished: p?.finished ?? false,
    lastPlayedAt: p?.lastPlayedAt ?? null,
  };
}

/**
 * The library as one listener sees it: the online catalogue merged with their
 * own progress, favourites, bookmarks and listening stats (kept locally and
 * synced to their account).
 */
export function useLibrary(store: LibraryStore, profileId: string, catalog: CatalogTrack[] | null, onLocalChange: () => void) {
  const [progress, setProgress] = useState<ReadonlyMap<string, Progress>>(new Map());
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [stats, setStats] = useState<ReadonlyMap<string, DayStats>>(new Map());
  const [userLoaded, setUserLoaded] = useState(false);
  const [writeError, setWriteError] = useState(false);

  const progressRef = useRef(new Map<string, Progress>());
  const bookmarksRef = useRef<Bookmark[]>([]);
  const statsRef = useRef(new Map<string, DayStats>());
  const dirtyStats = useRef(new Set<string>());
  const changed = useRef(onLocalChange);
  changed.current = onLocalChange;

  const fail = useCallback((e: unknown) => {
    console.warn('[shruti] storage write failed', e);
    setWriteError(true);
  }, []);

  const loadFromStore = useCallback(async () => {
    const data = await store.loadUserData(profileId);
    progressRef.current = new Map(data.progress.map((p) => [p.trackId, p]));
    setProgress(new Map(progressRef.current));
    bookmarksRef.current = data.bookmarks;
    setBookmarks(data.bookmarks);
    statsRef.current = new Map(data.stats.map((s) => [s.day, s]));
    setStats(new Map(statsRef.current));
  }, [store, profileId]);

  useEffect(() => {
    let cancelled = false;
    loadFromStore()
      .catch(fail)
      .finally(() => !cancelled && setUserLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [loadFromStore, fail]);

  const tracks = useMemo(() => (catalog ?? []).map((c) => toTrack(c, progress.get(c.id))), [catalog, progress]);
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;
  const coverUrls = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of catalog ?? []) if (c.coverUrl) m.set(c.id, c.coverUrl);
    return m as ReadonlyMap<string, string>;
  }, [catalog]);

  /* ---------------------------------------------------------- progress */

  const find = (id: string) => tracksRef.current.find((t) => t.id === id);

  const patchProgress = useCallback(
    (id: string, patch: ProgressPatch) => {
      const t = tracksRef.current.find((x) => x.id === id);
      if (!t) return;
      const updated = { ...t, ...patch };
      const p = progressOf(profileId, updated);
      progressRef.current.set(id, p);
      setProgress(new Map(progressRef.current));
      // Keep the ref in step so rapid successive patches build on each other.
      tracksRef.current = tracksRef.current.map((x) => (x.id === id ? updated : x));
      store.saveProgress(p).catch(fail);
      changed.current();
    },
    [store, profileId, fail],
  );

  const toggleFavorite = useCallback((id: string) => {
    const t = find(id);
    if (t) patchProgress(id, { favorite: !t.favorite });
  }, [patchProgress]);

  const setFinished = useCallback((id: string, finished: boolean) => {
    patchProgress(id, finished ? { finished: true, position: 0 } : { finished: false });
  }, [patchProgress]);

  const savePosition = useCallback(
    (id: string, seconds: number, finished: boolean) => {
      const t = find(id);
      if (!t || !Number.isFinite(seconds)) return;
      if (finished) {
        if (!t.finished || t.position !== 0) patchProgress(id, { position: 0, finished: true });
        return;
      }
      const position = Math.max(0, Math.round(seconds * 10) / 10);
      if (position !== t.position || (t.finished && position > 0)) patchProgress(id, { position, finished: t.finished && position === 0 });
    },
    [patchProgress],
  );

  const markPlayed = useCallback((id: string) => patchProgress(id, { lastPlayedAt: Date.now() }), [patchProgress]);

  /* --------------------------------------------------------- bookmarks */

  const putBookmark = useCallback(
    (b: Bookmark) => {
      const next = [...bookmarksRef.current.filter((x) => x.id !== b.id), b];
      bookmarksRef.current = next;
      setBookmarks(next);
      store.putBookmarks([b]).catch(fail);
      changed.current();
    },
    [store, fail],
  );

  const addBookmark = useCallback(
    (trackId: string, time: number, note = '') => {
      const now = Date.now();
      const b: Bookmark = { id: newId(), profileId, trackId, time: Math.round(time * 10) / 10, note, createdAt: now, updatedAt: now };
      putBookmark(b);
      return b;
    },
    [profileId, putBookmark],
  );

  const editBookmark = useCallback(
    (id: string, note: string) => {
      const b = bookmarksRef.current.find((x) => x.id === id);
      if (b) putBookmark({ ...b, note, updatedAt: Date.now() });
    },
    [putBookmark],
  );

  const deleteBookmark = useCallback(
    (id: string) => {
      const b = bookmarksRef.current.find((x) => x.id === id);
      if (b) putBookmark({ ...b, deleted: true, updatedAt: Date.now() });
    },
    [putBookmark],
  );

  /* ------------------------------------------------------------- stats */

  const flushStats = useCallback(() => {
    for (const day of dirtyStats.current) {
      const s = statsRef.current.get(day);
      if (s) store.putStats(s).catch(fail);
    }
    dirtyStats.current.clear();
    setStats(new Map(statsRef.current));
  }, [store, fail]);

  const addListening = useCallback(
    (seconds: number, savedSeconds: number) => {
      const day = dayKey();
      const cur = statsRef.current.get(day) ?? { profileId, day, seconds: 0, savedSeconds: 0 };
      statsRef.current.set(day, { ...cur, seconds: cur.seconds + seconds, savedSeconds: cur.savedSeconds + savedSeconds });
      dirtyStats.current.add(day);
    },
    [profileId],
  );

  useEffect(() => {
    const timer = setInterval(flushStats, STATS_FLUSH_MS);
    window.addEventListener('pagehide', flushStats);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', flushStats);
      flushStats();
    };
  }, [flushStats]);

  return {
    loaded: userLoaded && catalog != null,
    tracks,
    tracksRef,
    coverUrls,
    bookmarks,
    stats,
    writeError,
    reload: loadFromStore,
    toggleFavorite,
    setFinished,
    savePosition,
    markPlayed,
    addBookmark,
    editBookmark,
    deleteBookmark,
    addListening,
  };
}

export type Library = ReturnType<typeof useLibrary>;
