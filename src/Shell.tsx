import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenrePicker } from './components/GenrePicker';
import { BookmarkIcon, GearIcon, HomeIcon, LibraryIcon, MasksIcon } from './components/Icons';
import { ImportGenreSheet } from './components/ImportGenreSheet';
import { Sheet } from './components/Sheet';
import { MiniPlayer } from './components/MiniPlayer';
import { NowPlaying, type PlayerSheet } from './components/NowPlaying';
import { ChaptersSheet, EffectsSheet, QueueSheet, SleepSheet, SpeedSheet, TrackBookmarksSheet } from './components/PlayerSheets';
import type { ProfileApi } from './components/ProfileGate';
import { TrackMenu } from './components/TrackMenu';
import { useCloudSync } from './hooks/useCloudSync';
import { useDurationProbe } from './hooks/useDurationProbe';
import { useLibrary, type ImportResult } from './hooks/useLibrary';
import type { LibraryStore } from './lib/db';
import { getEngine, useEngine } from './lib/engine';
import { formatTime } from './lib/format';
import { loadSettings, lsGet, lsSet, saveSettings, type Settings } from './lib/settings';
import { trackStatus, type Profile, type Track } from './lib/types';
import { ShellContext, type ShellValue } from './shellContext';
import { BookmarksView } from './views/BookmarksView';
import { GenresView } from './views/GenresView';
import { HomeView } from './views/HomeView';
import { LibraryView } from './views/LibraryView';
import { SettingsView } from './views/SettingsView';

type Tab = 'home' | 'library' | 'genres' | 'bookmarks' | 'settings';
type SheetState = { kind: 'track'; id: string } | { kind: 'bookmarks'; id: string } | { kind: 'genres'; id: string } | { kind: PlayerSheet } | null;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function comparator(sort: Settings['sort']): (a: Track, b: Track) => number {
  const byTitle = (a: Track, b: Track) => collator.compare(a.title, b.title) || collator.compare(a.id, b.id);
  switch (sort) {
    case 'title':
      return byTitle;
    case 'added':
      return (a, b) => b.addedAt - a.addedAt || byTitle(a, b);
    case 'played':
      return (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || byTitle(a, b);
    case 'length':
      return (a, b) => (b.duration ?? 0) - (a.duration ?? 0) || byTitle(a, b);
    default:
      return (a, b) => {
        if (a.trackNo != null && b.trackNo != null && a.trackNo !== b.trackNo) return a.trackNo - b.trackNo;
        if (a.trackNo != null && b.trackNo == null) return -1;
        if (a.trackNo == null && b.trackNo != null) return 1;
        return byTitle(a, b);
      };
  }
}

function describeImport(r: ImportResult): string {
  if (r.noAudio) return 'কোনো অডিও ফাইল পাওয়া যায়নি · No audio files in that selection';
  const parts = [`${r.added} new, ${r.skipped} already existed`];
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.quotaHit) parts.push('stopped: device storage is full');
  else if (r.lowSpaceWarning) parts.push('storage is nearly full');
  if (r.persisted === false) parts.push('browser may clear this data if space runs low');
  return parts.join(' · ');
}

export function Shell({ store, profile, profiles, storageError }: { store: LibraryStore; profile: Profile; profiles: ProfileApi; storageError: unknown }) {
  const engine = getEngine();
  const dirty = useRef<() => void>(() => {});
  const lib = useLibrary(store, profile.id, () => dirty.current());
  const sync = useCloudSync(store, profile, lib.reload);
  dirty.current = sync.markDirty;
  useDurationProbe(store, lib.tracks, lib.tracksRef, lib.setDuration);

  const [settings, setSettings] = useState<Settings>(() => loadSettings(profile.id));
  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((s) => {
        const next = { ...s, ...patch };
        saveSettings(profile.id, next);
        return next;
      }),
    [profile.id],
  );

  const [tab, setTab] = useState<Tab>(() => lsGet<Tab>('shruti.tab', 'home'));
  const [query, setQuery] = useState('');
  const [nowOpen, setNowOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const queueKey = `shruti.queue.${profile.id}`;
  const [queue, setQueueState] = useState<string[]>(() => lsGet<string[]>(queueKey, []));
  const setQueue = useCallback(
    (fn: (q: string[]) => string[]) =>
      setQueueState((q) => {
        const next = fn(q);
        lsSet(queueKey, next);
        return next;
      }),
    [queueKey],
  );
  const [pendingImport, setPendingImport] = useState<File[] | null>(null);
  const [playContext, setPlayContext] = useState<string[] | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const currentId = useEngine((s) => s.trackId);
  const playing = useEngine((s) => s.playing);
  const engineError = useEngine((s) => s.error);

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (engineError) showToast(engineError);
  }, [engineError, showToast]);

  useEffect(() => lsSet('shruti.tab', tab), [tab]);
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  // Theme: data-theme on <html> overrides the system preference.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  /* ----------------------------------------------------- lists & order */

  const sorted = useMemo(() => [...lib.tracks].sort(comparator(settings.sort)), [lib.tracks, settings.sort]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const f = settings.filter;
    return sorted.filter((t) => {
      if (f === 'favorites' && !t.favorite) return false;
      if (f !== 'all' && f !== 'favorites' && trackStatus(t) !== f) return false;
      return !q || t.title.toLocaleLowerCase().includes(q) || (t.album ?? '').toLocaleLowerCase().includes(q);
    });
  }, [sorted, settings.filter, query]);
  const trackMap = useMemo(() => new Map(lib.tracks.map((t) => [t.id, t])), [lib.tracks]);
  const currentTrack = currentId ? trackMap.get(currentId) ?? null : null;

  // Prev/next move within the visible list; fall back to the full sorted list when the current track is filtered out.
  const navList = useMemo(() => {
    if (playContext && currentId && playContext.includes(currentId)) return playContext.map((id) => trackMap.get(id)).filter((t): t is Track => !!t);
    return currentId && !visible.some((t) => t.id === currentId) ? sorted : visible;
  }, [playContext, visible, sorted, currentId, trackMap]);
  const navIndex = currentId ? navList.findIndex((t) => t.id === currentId) : -1;

  /* ---------------------------------------------------------- playback */

  const lastKey = `shruti.last.${profile.id}`;
  const play = useCallback(
    (id: string, opts: { at?: number; autoplay?: boolean; context?: string[] } = {}) => {
      const t = lib.tracksRef.current.find((x) => x.id === id);
      if (!t) return;
      if (opts.context) setPlayContext(opts.context);
      const autoplay = opts.autoplay ?? true;
      if (engine.state.trackId === id && opts.at == null) {
        if (autoplay) engine.toggle();
        return;
      }
      if (engine.state.trackId === id && opts.at != null) {
        engine.seek(opts.at);
        engine.play();
        return;
      }
      setQueue((q) => q.filter((x) => x !== id));
      void engine.load(id, () => store.getAudio(id), { position: opts.at ?? (t.finished ? 0 : t.position), autoplay });
      lsSet(lastKey, id);
    },
    [engine, lib.tracksRef, store, lastKey, setQueue],
  );

  const nav = useRef({ navList, navIndex, queue });
  nav.current = { navList, navIndex, queue };

  const goNext = useCallback(() => {
    const { navList, navIndex, queue } = nav.current;
    if (queue.length) return play(queue[0]);
    const next = navList[navIndex + 1];
    if (navIndex >= 0 && next) play(next.id);
  }, [play]);
  const goPrev = useCallback(() => {
    const { navList, navIndex } = nav.current;
    const prev = navList[navIndex - 1];
    if (navIndex > 0 && prev) play(prev.id);
  }, [play]);

  // Engine → library/profile wiring.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    engine.hooks = {
      savePosition: lib.savePosition,
      ended: () => settingsRef.current.autoPlayNext && goNext(),
      duration: lib.setDuration,
      started: lib.markPlayed,
      listened: lib.addListening,
      next: goNext,
      prev: goPrev,
      notify: showToast,
    };
  }, [engine, lib.savePosition, lib.setDuration, lib.markPlayed, lib.addListening, goNext, goPrev, showToast]);

  useEffect(() => {
    engine.skipBack = settings.skipBack;
    engine.skipForward = settings.skipForward;
    engine.autoRewind = settings.autoRewind;
    engine.shakeToExtend = settings.shakeToExtend;
    engine.setEffects({ boost: settings.boost, skipSilence: settings.skipSilence, voiceClarity: settings.voiceClarity });
  }, [engine, settings.skipBack, settings.skipForward, settings.autoRewind, settings.shakeToExtend, settings.boost, settings.skipSilence, settings.voiceClarity]);

  // Restore speed and the last episode (paused) when the profile opens; stop playback when it closes.
  useEffect(() => {
    engine.setRate(loadSettings(profile.id).speed);
  }, [engine, profile.id]);
  const restored = useRef(false);
  useEffect(() => {
    if (!lib.loaded || restored.current) return;
    restored.current = true;
    const last = lsGet<string | null>(lastKey, null);
    if (last && lib.tracksRef.current.some((t) => t.id === last)) play(last, { autoplay: false });
  }, [lib.loaded, lib.tracksRef, lastKey, play]);
  useEffect(() => () => engine.unload(), [engine]);

  const coverUrl = currentTrack ? lib.coverUrls.get(currentTrack.id) : undefined;
  useEffect(() => {
    engine.setNowPlaying(currentTrack ? { title: currentTrack.title, artist: currentTrack.artist, album: currentTrack.album, coverUrl } : null);
  }, [engine, currentTrack?.title, currentTrack?.artist, currentTrack?.album, coverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: space play/pause, ←/→ skip (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || el.closest('input, textarea, select, button, [contenteditable], [role="dialog"] form')) return;
      if (!engine.state.trackId) return;
      if (e.key === ' ') {
        e.preventDefault();
        engine.toggle();
      } else if (e.key === 'ArrowLeft') engine.skip(-settingsRef.current.skipBack);
      else if (e.key === 'ArrowRight') engine.skip(settingsRef.current.skipForward);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  /* ------------------------------------------------------------ import */

  const importFiles = useCallback(
    async (files: File[], genres?: string[]) => {
      if (!files.length) return null;
      const result = await lib.importFiles(files, genres);
      showToast(describeImport(result));
      return result;
    },
    [lib, showToast],
  );
  const onPicked = (input: HTMLInputElement) => {
    const files = input.files ? Array.from(input.files) : [];
    input.value = ''; // allow re-picking the same folder later
    if (files.length) setPendingImport(files); // ask for the genre first
  };

  /* ------------------------------------------------------------ queue */

  const playNext = (id: string) => setQueue((q) => [id, ...q.filter((x) => x !== id)]);
  const toggleQueue = (id: string) => setQueue((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]));
  // Drop queue entries for tracks that no longer exist.
  useEffect(() => {
    if (lib.loaded) setQueue((q) => (q.every((id) => trackMap.has(id)) ? q : q.filter((id) => trackMap.has(id))));
  }, [lib.loaded, trackMap, setQueue]);

  const deleteTrack = async (id: string) => {
    const title = trackMap.get(id)?.title ?? '';
    if (engine.state.trackId === id) {
      engine.unload();
      setNowOpen(false);
    }
    await lib.removeTrack(id);
    showToast(`মুছে ফেলা হয়েছে · Deleted “${title}”`);
  };

  const trackBookmarks = useCallback((id: string) => lib.bookmarks.filter((b) => b.trackId === id && !b.deleted), [lib.bookmarks]);
  const savedSeconds = useMemo(() => [...lib.stats.values()].reduce((s, d) => s + d.savedSeconds, 0), [lib.stats]);

  const value: ShellValue = {
    store,
    profile,
    profiles,
    lib,
    sync,
    settings,
    updateSettings,
    sorted,
    visible,
    query,
    setQuery,
    queue,
    currentId,
    playing,
    play,
    openMenu: (id) => setSheet({ kind: 'track', id }),
    importFiles,
    pickFolder: () => folderInput.current?.click(),
    pickFiles: () => filesInput.current?.click(),
    toast: showToast,
  };

  const storageWarning =
    store.mode === 'memory'
      ? 'এই ব্রাউজারে স্থায়ী স্টোরেজ পাওয়া যাচ্ছে না (প্রাইভেট মোড?) — ট্যাব বন্ধ করলে লাইব্রেরি হারিয়ে যাবে। Persistent storage is unavailable here.'
      : storageError
        ? 'সংরক্ষিত লাইব্রেরি পড়া যায়নি · Could not read the saved library.'
        : lib.writeError
          ? 'কিছু পরিবর্তন সেভ হয়নি · Some changes could not be saved to this device (storage full?).'
          : null;

  const sheetTrack = sheet && 'id' in sheet ? trackMap.get(sheet.id) : currentTrack;

  return (
    <ShellContext.Provider value={value}>
      <div className={`app${currentTrack ? ' has-player' : ''}${nowOpen || sheet || pendingImport ? ' modal-open' : ''}`}>
        <input ref={folderInput} type="file" multiple accept="audio/*" hidden onChange={(e) => onPicked(e.currentTarget)} />
        <input ref={filesInput} type="file" multiple accept="audio/*,.mp3,.m4a,.m4b,.ogg,.opus" hidden onChange={(e) => onPicked(e.currentTarget)} />

        {storageWarning && !bannerDismissed && (
          <div className="banner" role="alert">
            <span>{storageWarning}</span>
            <button type="button" className="btn ghost sm" onClick={() => setBannerDismissed(true)}>
              ঠিক আছে
            </button>
          </div>
        )}

        <main className="content" inert={nowOpen || sheet != null || pendingImport != null}>
          {tab === 'home' && <HomeView />}
          {tab === 'library' && <LibraryView />}
          {tab === 'genres' && <GenresView />}
          {tab === 'bookmarks' && <BookmarksView />}
          {tab === 'settings' && <SettingsView />}
        </main>

        <div className="dock" inert={nowOpen || sheet != null || pendingImport != null}>
          {currentTrack && <MiniPlayer track={currentTrack} coverUrl={coverUrl} skipForward={settings.skipForward} onOpen={() => setNowOpen(true)} />}
          <nav className="tabbar" aria-label="Sections">
            {(
              [
                ['home', 'হোম', HomeIcon],
                ['library', 'লাইব্রেরি', LibraryIcon],
                ['genres', 'ধরন', MasksIcon],
                ['bookmarks', 'বুকমার্ক', BookmarkIcon],
                ['settings', 'সেটিংস', GearIcon],
              ] as const
            ).map(([key, label, Icon]) => (
              <button key={key} type="button" className={tab === key ? 'on' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => (setTab(key), window.scrollTo({ top: 0 }))}>
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {nowOpen && currentTrack && (
          <NowPlaying
            inert={sheet != null}
            track={currentTrack}
            coverUrl={coverUrl}
            bookmarks={trackBookmarks(currentTrack.id)}
            queueLength={queue.length}
            skipBack={settings.skipBack}
            skipForward={settings.skipForward}
            effectsOn={settings.boost > 1 || settings.skipSilence || settings.voiceClarity}
            hasPrev={navIndex > 0}
            hasNext={queue.length > 0 || (navIndex >= 0 && navIndex < navList.length - 1)}
            onClose={() => setNowOpen(false)}
            onPrev={goPrev}
            onNext={goNext}
            onSheet={(kind) => setSheet({ kind })}
            onMore={() => setSheet({ kind: 'track', id: currentTrack.id })}
            onToggleFavorite={() => lib.toggleFavorite(currentTrack.id)}
            onQuickBookmark={() => {
              const b = lib.addBookmark(currentTrack.id, engine.state.time);
              showToast(`বুকমার্ক সেভ হয়েছে ${formatTime(b.time)}-এ · Bookmarked`);
            }}
          />
        )}

        {sheet?.kind === 'track' && sheetTrack && (
          <TrackMenu
            track={sheetTrack}
            coverUrl={lib.coverUrls.get(sheetTrack.id)}
            isPlaying={currentId === sheetTrack.id && playing}
            queued={queue.includes(sheetTrack.id)}
            bookmarkCount={trackBookmarks(sheetTrack.id).length}
            onClose={() => setSheet(null)}
            onPlay={() => play(sheetTrack.id)}
            onPlayNext={() => (playNext(sheetTrack.id), showToast('এর পরে চলবে · Plays next'))}
            onToggleQueue={() => toggleQueue(sheetTrack.id)}
            onToggleFavorite={() => lib.toggleFavorite(sheetTrack.id)}
            onSetFinished={(f) => lib.setFinished(sheetTrack.id, f)}
            onBookmarks={() => setTimeout(() => setSheet({ kind: 'bookmarks', id: sheetTrack.id }))}
            onGenres={() => setTimeout(() => setSheet({ kind: 'genres', id: sheetTrack.id }))}
            onRename={(title) => lib.rename(sheetTrack.id, title)}
            onDelete={() => void deleteTrack(sheetTrack.id)}
          />
        )}
        {sheet?.kind === 'bookmarks' && sheetTrack && (
          <TrackBookmarksSheet
            track={sheetTrack}
            bookmarks={trackBookmarks(sheetTrack.id)}
            onClose={() => setSheet(null)}
            onAdd={(time, note) => lib.addBookmark(sheetTrack.id, time, note)}
            onEdit={lib.editBookmark}
            onDelete={lib.deleteBookmark}
            onJump={(b) => {
              play(b.trackId, { at: b.time });
              setSheet(null);
            }}
          />
        )}
        {sheet?.kind === 'genres' && sheetTrack && (
          <GenreSheet
            track={sheetTrack}
            onClose={() => setSheet(null)}
            onSave={(tags) => {
              lib.setGenres(sheetTrack.id, tags);
              setSheet(null);
              showToast('ধরন সেভ হয়েছে · Genres saved');
            }}
          />
        )}
        {pendingImport && (
          <ImportGenreSheet
            files={pendingImport}
            onCancel={() => setPendingImport(null)}
            onImport={(genres) => {
              const files = pendingImport;
              setPendingImport(null);
              void importFiles(files, genres);
            }}
          />
        )}
        {sheet?.kind === 'speed' && (
          <SpeedSheet
            onClose={() => setSheet(null)}
            onChange={(r) => {
              engine.setRate(r);
              updateSettings({ speed: r });
            }}
          />
        )}
        {sheet?.kind === 'sleep' && <SleepSheet settings={settings} onClose={() => setSheet(null)} onSettings={updateSettings} />}
        {sheet?.kind === 'effects' && <EffectsSheet settings={settings} savedSeconds={savedSeconds} onClose={() => setSheet(null)} onSettings={updateSettings} />}
        {sheet?.kind === 'chapters' && currentTrack && <ChaptersSheet chapters={currentTrack.chapters} onClose={() => setSheet(null)} />}
        {sheet?.kind === 'queue' && (
          <QueueSheet
            queue={queue}
            tracks={trackMap}
            coverUrls={lib.coverUrls}
            onClose={() => setSheet(null)}
            onPlay={(id) => play(id)}
            onMove={(i, d) =>
              setQueue((q) => {
                const next = q.slice();
                const [item] = next.splice(i, 1);
                next.splice(Math.max(0, Math.min(next.length, i + d)), 0, item);
                return next;
              })
            }
            onRemove={(id) => setQueue((q) => q.filter((x) => x !== id))}
            onClear={() => setQueue(() => [])}
          />
        )}

        {toast && (
          <div className="toast" role="status" aria-live="polite" key={toast.key}>
            {toast.text}
          </div>
        )}
      </div>
    </ShellContext.Provider>
  );
}

function GenreSheet({ track, onClose, onSave }: { track: Track; onClose(): void; onSave(tags: string[]): void }) {
  const [tags, setTags] = useState<string[]>(track.genres ?? []);
  return (
    <Sheet title={`ধরন · ${track.title}`} onClose={onClose}>
      <p className="setting-text">এক বা একাধিক ধরন বেছে নিন। শুধু মূল ধরন ছুঁলে উপ-ধরন ছাড়াই সেই ধরনে থাকবে।</p>
      <GenrePicker value={tags} onChange={setTags} />
      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          বাতিল
        </button>
        <button type="button" className="btn primary" onClick={() => onSave(tags)}>
          সেভ করুন
        </button>
      </div>
    </Sheet>
  );
}
