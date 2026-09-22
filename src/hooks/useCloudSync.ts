import { useCallback, useEffect, useRef, useState } from 'react';
import { describeCloudError, getCloudConfig, pullRemote, pushRemote } from '../lib/cloud';
import type { LibraryStore } from '../lib/db';
import { mergeSync } from '../lib/sync';
import type { Profile } from '../lib/types';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'ok' | 'error';

const DEBOUNCE_MS = 15_000;

/**
 * Keeps one profile's listening state in sync with its Google-linked cloud
 * copy. Local-first: everything works offline, sync catches up when possible.
 */
export function useCloudSync(store: LibraryStore, profile: Profile, reload: () => Promise<void>) {
  const uid = profile.google?.uid ?? null;
  const enabled = uid != null && getCloudConfig() != null;
  const [status, setStatus] = useState<SyncStatus>(enabled ? 'idle' : 'off');
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const syncNow = useCallback(async () => {
    if (!enabled || !uid) return;
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const run = (async () => {
      setStatus('syncing');
      try {
        const [remote, progress, bookmarks] = await Promise.all([pullRemote(uid), store.getProgress(profile.id), store.getBookmarks(profile.id)]);
        const merged = mergeSync(profile.id, { progress, bookmarks }, remote);
        if (merged.localProgress.length) await store.saveProgressMany(merged.localProgress);
        if (merged.localBookmarks.length) await store.putBookmarks(merged.localBookmarks);
        if (merged.localProgress.length || merged.localBookmarks.length) await reload();
        if (merged.remoteChanged) await pushRemote(uid, merged.remote);
        setStatus('ok');
        setError(null);
        setLastSynced(Date.now());
      } catch (e) {
        console.warn('[shruti] sync failed', e);
        setStatus('error');
        setError(describeCloudError(e));
      }
    })();
    running.current = run;
    await run;
    running.current = null;
    if (again.current) {
      again.current = false;
      void syncNow();
    }
  }, [enabled, uid, store, profile.id, reload]);

  /** Call after any local change; syncs after a quiet period. */
  const markDirty = useCallback(() => {
    if (!enabled) return;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void syncNow(), DEBOUNCE_MS);
  }, [enabled, syncNow]);

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    void syncNow();
    const onOnline = () => void syncNow();
    const onHide = () => document.visibilityState === 'hidden' && void syncNow();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [enabled, syncNow]);

  return { enabled, status, error, lastSynced, syncNow, markDirty };
}
