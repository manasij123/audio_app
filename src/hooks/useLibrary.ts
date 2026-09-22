import { useCallback, useEffect, useRef, useState } from 'react';
import { freeSpaceBytes, isQuotaError, openLibraryStore, requestPersistence, type LibraryStore } from '../lib/db';
import { guessMime, isAudioFile, titleFromFileName, trackIdFor, trackNoFromFileName } from '../lib/filename';
import { parseTrackNumber, readTags, type Id3Tags } from '../lib/id3';
import type { Track } from '../lib/types';

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

/** How often (in files) to publish newly imported tracks to the UI during an import. */
const PUBLISH_EVERY = 5;

export function useLibrary() {
  const [store, setStore] = useState<LibraryStore | null>(null);
  const [storageError, setStorageError] = useState<unknown>(null);
  const [writeError, setWriteError] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [coverUrls, setCoverUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  // Mirrors of state for use inside async flows/callbacks without stale closures.
  const tracksRef = useRef<Track[]>([]);
  const storeRef = useRef<LibraryStore | null>(null);
  const coversRef = useRef(new Map<string, string>());

  const commit = useCallback((next: Track[]) => {
    tracksRef.current = next;
    setTracks(next);
  }, []);

  const publishCovers = useCallback(() => setCoverUrls(new Map(coversRef.current)), []);

  // Open the DB and load the library once on startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { store, error } = await openLibraryStore();
      let data: Awaited<ReturnType<LibraryStore['loadAll']>> = { tracks: [], covers: new Map() };
      try {
        data = await store.loadAll();
      } catch (e) {
        console.warn('[shruti] failed to load library', e);
        if (!cancelled) setStorageError(e);
      }
      if (cancelled) return;
      storeRef.current = store;
      setStore(store);
      if (error) setStorageError(error);
      for (const [id, blob] of data.covers) coversRef.current.set(id, URL.createObjectURL(blob));
      publishCovers();
      commit(data.tracks);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [commit, publishCovers]);

  const persist = useCallback((t: Track) => {
    storeRef.current?.saveMeta(t).catch((e) => {
      console.warn('[shruti] failed to save track', e);
      setWriteError(true);
    });
  }, []);

  /** Patch a track in memory and persist it. Ignores ids that no longer exist (e.g. just deleted). */
  const updateTrack = useCallback(
    (id: string, patch: Partial<Track>) => {
      const cur = tracksRef.current;
      const i = cur.findIndex((t) => t.id === id);
      if (i < 0) return;
      const updated = { ...cur[i], ...patch };
      const next = cur.slice();
      next[i] = updated;
      commit(next);
      persist(updated);
    },
    [commit, persist],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const t = tracksRef.current.find((x) => x.id === id);
      if (t) updateTrack(id, { favorite: !t.favorite });
    },
    [updateTrack],
  );

  const savePosition = useCallback(
    (id: string, position: number) => {
      const t = tracksRef.current.find((x) => x.id === id);
      if (!t || !Number.isFinite(position)) return;
      const rounded = Math.max(0, Math.round(position * 10) / 10);
      if (rounded !== t.position) updateTrack(id, { position: rounded });
    },
    [updateTrack],
  );

  const setDuration = useCallback(
    (id: string, duration: number) => {
      const t = tracksRef.current.find((x) => x.id === id);
      if (t && (t.duration == null || Math.abs(t.duration - duration) > 1)) updateTrack(id, { duration });
    },
    [updateTrack],
  );

  const removeTrack = useCallback(
    async (id: string) => {
      commit(tracksRef.current.filter((t) => t.id !== id));
      const url = coversRef.current.get(id);
      if (url) {
        coversRef.current.delete(id);
        URL.revokeObjectURL(url);
        publishCovers();
      }
      try {
        await storeRef.current?.remove(id);
      } catch (e) {
        console.warn('[shruti] failed to delete track', e);
        setWriteError(true);
      }
    },
    [commit, publishCovers],
  );

  const importFiles = useCallback(
    async (picked: File[]): Promise<ImportResult> => {
      const store = storeRef.current;
      const result: ImportResult = {
        added: 0,
        skipped: 0,
        failed: 0,
        noAudio: false,
        quotaHit: false,
        lowSpaceWarning: false,
        persisted: null,
      };
      const files = picked.filter(isAudioFile);
      if (!store || files.length === 0) {
        result.noAudio = files.length === 0;
        return result;
      }

      const existing = new Set(tracksRef.current.map((t) => t.id));
      const fresh = files.filter((f) => !existing.has(trackIdFor(f)));
      result.skipped = files.length - fresh.length;

      const needed = fresh.reduce((sum, f) => sum + f.size, 0);
      const free = await freeSpaceBytes();
      if (free != null && needed > free) result.lowSpaceWarning = true;

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
    [commit, publishCovers],
  );

  return {
    store,
    loaded,
    tracks,
    tracksRef,
    coverUrls,
    progress,
    storageError,
    writeError,
    importFiles,
    toggleFavorite,
    savePosition,
    setDuration,
    removeTrack,
  };
}
