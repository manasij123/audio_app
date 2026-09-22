import { useEffect, useRef, type RefObject } from 'react';
import type { LibraryStore } from '../lib/db';
import type { Track } from '../lib/types';

const PROBE_TIMEOUT_MS = 20_000;

async function probeDuration(el: HTMLAudioElement, store: LibraryStore, id: string): Promise<number | null> {
  let blob: Blob | null;
  try {
    blob = await store.getAudio(id);
  } catch {
    return null;
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<number | null>((resolve) => {
      const done = (value: number | null) => {
        clearTimeout(timer);
        el.onloadedmetadata = null;
        el.onerror = null;
        resolve(value);
      };
      const timer = setTimeout(() => done(null), PROBE_TIMEOUT_MS);
      el.onloadedmetadata = () => {
        const d = el.duration;
        done(Number.isFinite(d) && d > 0 ? d : null);
      };
      el.onerror = () => done(null);
      el.src = url;
    });
  } finally {
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Lazily fills in missing durations, one file at a time, with a hidden
 * <audio> element (only metadata is read, not the whole file).
 */
export function useDurationProbe(
  store: LibraryStore | null,
  tracks: Track[],
  tracksRef: RefObject<Track[]>,
  setDuration: (id: string, d: number) => void,
) {
  const wakeRef = useRef<(() => void) | null>(null);
  const failed = useRef(new Set<string>());

  useEffect(() => {
    if (!store) return;
    let stopped = false;
    const el = document.createElement('audio');
    el.preload = 'metadata';
    el.muted = true;

    (async () => {
      while (!stopped) {
        const next = tracksRef.current.find((t) => t.duration == null && !failed.current.has(t.id));
        if (!next) {
          await new Promise<void>((resolve) => (wakeRef.current = resolve));
          wakeRef.current = null;
          continue;
        }
        const d = await probeDuration(el, store, next.id);
        if (stopped) break;
        if (d) setDuration(next.id, d);
        else failed.current.add(next.id);
      }
    })();

    return () => {
      stopped = true;
      wakeRef.current?.();
    };
  }, [store, tracksRef, setDuration]);

  // New tracks arrived (import) → wake the loop if it is idle.
  useEffect(() => {
    wakeRef.current?.();
  }, [tracks]);
}
