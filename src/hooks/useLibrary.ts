import { useCallback, useEffect, useRef, useState } from 'react';
import { isQuotaError, progressOf, requestPersistence, storageEstimate, type LibraryStore } from '../lib/db';
import { guessMime, isAudioFile, titleFromFileName, trackIdFor, trackNoFromFileName } from '../lib/filename';
import { parseTrackNumber, readTags, type Id3Tags } from '../lib/id3';
import type { Bookmark, DayStats, Track } from '../lib/types';

export interface ImportProgress {
  done: number;
  total: number;
  current: string;
}

export interface ImportResult {
  added: number;
  skipped: number;
  failed: number;
  noAudio: boolean;
  quotaHit: boolean;
  lowSpaceWarning: boolean;
  persisted: boolean | null;
}

type ProgressPatch = Partial<Pick<Track, 'position' | 'favorite' | 'finished' | 'lastPlayedAt'>>;
type MetaPatch = Partial<Pick<Track, 'title' | 'duration'>>;

/** How often (in files) to publish newly imported tracks to the UI during an import. */
const PUBLISH_EVERY = 5;
const STATS_FLUSH_MS = 20_000;

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/**
 * The library as seen by one profile: shared tracks and covers, plus that
 * profile's own progress, favorites, bookmarks and listening stats.
 */
export function useLibrary(store: LibraryStore, profileId: string, onLocalChange: () => void) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [coverUrls, setCoverUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [stats, setStats] = useState<ReadonlyMap<string, DayStats>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [writeError, setWriteError] = useState(false);

  const tracksRef = useRef<Track[]>([]);
  const bookmarksRef = useRef<Bookmark[]>([]);
  const statsRef = useRef(new Map<string, DayStats>());
  const dirtyStats = useRef(new Set<string>());
  const coversRef = useRef(new Map<string, string>());
  const changed = useRef(onLocalChange);
  changed.current = onLocalChange;

  const commit = useCallback((next: Track[]) => {
    tracksRef.current = next;
    setTracks(next);
  }, []);
  const commitBookmarks = useCallback((next: Bookmark[]) => {
    bookmarksRef.current = next;
    setBookmarks(next);
  }, []);
  const publishCovers = useCallback(() => setCoverUrls(new Map(coversRef.current)), []);
  const fail = useCallback((e: unknown) => {
    console.warn('[shruti] storage write failed', e);
    setWriteError(true);
  }, []);

  const loadFromStore = useCallback(async () => {
    const data = await store.load(profileId);
    for (const [id, blob] of data.covers) if (!coversRef.current.has(id)) coversRef.current.set(id, URL.createObjectURL(blob));
    publishCovers();
    commit(data.tracks);
    commitBookmarks(data.bookmarks);
    statsRef.current = new Map(data.stats.map((s) => [s.day, s]));
    setStats(new Map(statsRef.current));
  }, [store, profileId, commit, commitBookmarks, publishCovers]);

  useEffect(() => {
    let cancelled = false;
    loadFromStore()
      .catch(fail)
      .finally(() => !cancelled && setLoaded(true));
    const covers = coversRef.current;
    return () => {
      cancelled = true;
      for (const url of covers.values()) URL.revokeObjectURL(url);
      covers.clear();
    };
  }, [loadFromStore, fail]);

  /* ------------------------------------------------------------ tracks */

  const patchTrack = useCallback(
    (id: string, patch: ProgressPatch & MetaPatch, kind: 'progress' | 'meta') => {
      const cur = tracksRef.current;
      const i = cur.findIndex((t) => t.id === id);
      if (i < 0) return; // e.g. just deleted
      const updated = { ...cur[i], ...patch };
      const next = cur.slice();
      next[i] = updated;
      commit(next);
      if (kind === 'meta') store.saveMeta(updated).catch(fail);
      else {
        store.saveProgress(progressOf(profileId, updated)).catch(fail);
        changed.current();
      }
    },
    [commit, store, profileId, fail],
  );

  const find = (id: string) => tracksRef.current.find((t) => t.id === id);

  const toggleFavorite = useCallback((id: string) => {
    const t = find(id);
    if (t) patchTrack(id, { favorite: !t.favorite }, 'progress');
  }, [patchTrack]);

  const setFinished = useCallback((id: string, finished: boolean) => {
    patchTrack(id, finished ? { finished: true, position: 0 } : { finished: false }, 'progress');
  }, [patchTrack]);

  const savePosition = useCallback(
    (id: string, seconds: number, finished: boolean) => {
      const t = find(id);
      if (!t || !Number.isFinite(seconds)) return;
      if (finished) {
        if (!t.finished || t.position !== 0) patchTrack(id, { position: 0, finished: true }, 'progress');
        return;
      }
      const position = Math.max(0, Math.round(seconds * 10) / 10);
      // Listening again to a finished episode moves it back to "in progress".
      if (position !== t.position || (t.finished && position > 0)) patchTrack(id, { position, finished: t.finished && position === 0 }, 'progress');
    },
    [patchTrack],
  );

  const markPlayed = useCallback((id: string) => patchTrack(id, { lastPlayedAt: Date.now() }, 'progress'), [patchTrack]);

  const setDuration = useCallback(
    (id: string, duration: number) => {
      const t = find(id);
      if (t && (t.duration == null || Math.abs(t.duration - duration) > 1)) patchTrack(id, { duration }, 'meta');
    },
    [patchTrack],
  );

  const rename = useCallback((id: string, title: string) => {
    const clean = title.trim();
    if (clean) patchTrack(id, { title: clean }, 'meta');
  }, [patchTrack]);

  const removeTrack = useCallback(
    async (id: string) => {
      commit(tracksRef.current.filter((t) => t.id !== id));
      commitBookmarks(bookmarksRef.current.filter((b) => b.trackId !== id));
      const url = coversRef.current.get(id);
      if (url) {
        coversRef.current.delete(id);
        URL.revokeObjectURL(url);
        publishCovers();
      }
      await store.remove(id).catch(fail);
    },
    [commit, commitBookmarks, publishCovers, store, fail],
  );

  /* --------------------------------------------------------- bookmarks */

  const putBookmark = useCallback(
    (b: Bookmark) => {
      const rest = bookmarksRef.current.filter((x) => x.id !== b.id);
      commitBookmarks([...rest, b]);
      store.putBookmarks([b]).catch(fail);
      changed.current();
    },
    [commitBookmarks, store, fail],
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
      // Keep a tombstone so the deletion also reaches other synced devices.
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

  /* ------------------------------------------------------------ import */

  const importFiles = useCallback(
    async (picked: File[]): Promise<ImportResult> => {
      const result: ImportResult = { added: 0, skipped: 0, failed: 0, noAudio: false, quotaHit: false, lowSpaceWarning: false, persisted: null };
      const files = picked.filter(isAudioFile);
      if (files.length === 0) {
        result.noAudio = true;
        return result;
      }

      const existing = new Set(tracksRef.current.map((t) => t.id));
      const fresh = files.filter((f) => !existing.has(trackIdFor(f)));
      result.skipped = files.length - fresh.length;

      const needed = fresh.reduce((sum, f) => sum + f.size, 0);
      const est = await storageEstimate();
      if (est && needed > est.quota - est.usage) result.lowSpaceWarning = true;

      let pending: Track[] = [];
      const flush = () => {
        if (pending.length) {
          commit([...tracksRef.current, ...pending]);
          pending = [];
          publishCovers();
        }
      };

      setProgress({ done: 0, total: fresh.length, current: '' });
      try {
        for (let i = 0; i < fresh.length; i++) {
          const file = fresh[i];
          const id = trackIdFor(file);
          setProgress({ done: i, total: fresh.length, current: file.name });
          if (existing.has(id)) {
            result.skipped++; // same relative path picked twice in one batch
            continue;
          }

          let tags: Id3Tags = {};
          try {
            tags = await readTags(file);
          } catch (e) {
            console.warn('[shruti] could not read tags of', file.name, e);
          }

          const cover = tags.picture ? new Blob([tags.picture.data], { type: tags.picture.mime }) : null;
          const mimeType = guessMime(file);
          const audio = file.type ? file : new Blob([file], { type: mimeType });
          const track: Track = {
            id,
            title: tags.title || titleFromFileName(file.name),
            album: tags.album ?? null,
            artist: tags.artist ?? tags.albumArtist ?? null,
            trackNo: parseTrackNumber(tags.track) ?? trackNoFromFileName(file.name),
            sizeBytes: file.size,
            favorite: false,
            position: 0,
            duration: null,
            addedAt: Date.now(),
            fileName: file.name,
            mimeType,
            hasCover: cover != null,
            finished: false,
            lastPlayedAt: null,
            chapters: (tags.chapters ?? []).map((c, n) => ({ start: c.start, title: c.title || `অধ্যায় ${n + 1}` })),
          };

          try {
            await store.add(track, audio, cover);
          } catch (e) {
            console.warn('[shruti] failed to store', file.name, e);
            if (isQuotaError(e)) {
              result.quotaHit = true;
              break;
            }
            result.failed++;
            continue;
          }
          existing.add(id);
          if (cover) coversRef.current.set(id, URL.createObjectURL(cover));
          pending.push(track);
          result.added++;
          if (pending.length >= PUBLISH_EVERY) flush();
        }
      } finally {
        flush();
        setProgress(null);
      }

      if (result.added > 0 && store.mode === 'indexeddb') result.persisted = await requestPersistence();
      return result;
    },
    [commit, publishCovers, store],
  );

  return {
    loaded,
    tracks,
    tracksRef,
    coverUrls,
    bookmarks,
    stats,
    progress,
    writeError,
    reload: loadFromStore,
    importFiles,
    toggleFavorite,
    setFinished,
    savePosition,
    markPlayed,
    setDuration,
    rename,
    removeTrack,
    addBookmark,
    editBookmark,
    deleteBookmark,
    addListening,
  };
}

export type Library = ReturnType<typeof useLibrary>;
