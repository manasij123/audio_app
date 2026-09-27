import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenrePicker } from './components/GenrePicker';
import type { Account } from './components/AuthGate';
import { BookmarkIcon, GearIcon, HomeIcon, LibraryIcon, MasksIcon, ShieldIcon } from './components/Icons';
import { Sheet } from './components/Sheet';
import { MiniPlayer } from './components/MiniPlayer';
import { NowPlaying, type PlayerSheet } from './components/NowPlaying';
import { ChaptersSheet, EffectsSheet, QueueSheet, SleepSheet, SpeedSheet, TrackBookmarksSheet } from './components/PlayerSheets';
import { EqualizerSheet } from './components/skeuo/EqualizerSheet';
import { TrackMenu } from './components/TrackMenu';
import { Watermark } from './components/Watermark';
import { useCloudSync } from './hooks/useCloudSync';
import { useCatalog } from './hooks/useCatalog';
import { useLibrary } from './hooks/useLibrary';
import { audioUrl, deleteTrack as deleteFromServer, updateTrack } from './lib/catalog';
import { describeAuthError } from './lib/firebase';
import type { LibraryStore } from './lib/db';
import { getEngine, useEngine } from './lib/engine';
import { formatTime } from './lib/format';
import { hasTag } from './lib/genres';
import { loadSettings, lsGet, lsSet, saveSettings, type Settings } from './lib/settings';
import { trackStatus, type Profile, type Track } from './lib/types';
import { ShellContext, type ShellValue } from './shellContext';
import { AdminView } from './views/AdminView';
import { BookmarksView } from './views/BookmarksView';
import { GenresView } from './views/GenresView';
import { HomeView } from './views/HomeView';
import { LibraryView } from './views/LibraryView';
import { SettingsView } from './views/SettingsView';

type Tab = 'home' | 'library' | 'genres' | 'bookmarks' | 'settings' | 'admin';
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

export function Shell({ store, profile, account, storageError }: { store: LibraryStore; profile: Profile; account: Account; storageError: unknown }) {
  const engine = getEngine();
  const dirty = useRef<() => void>(() => {});
  const catalog = useCatalog(account.isAdmin);
  const lib = useLibrary(store, profile.id, catalog.tracks, () => dirty.current());
  const sync = useCloudSync(store, profile, lib.reload);
  dirty.current = sync.markDirty;

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

  const [tab, setTab] = useState<Tab>(() => {
    const t = lsGet<Tab>('shruti.tab', 'home');
    return t === 'admin' && !account.isAdmin ? 'home' : t;
  });
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
  const [genreSelection, setGenreSelection] = useState<string | null>(() => lsGet<string | null>('shruti.genre', null));
  useEffect(() => lsSet('shruti.genre', genreSelection ?? undefined), [genreSelection]);
  const [libraryGenre, setLibraryGenre] = useState<string | null>(null);
  const [playContext, setPlayContext] = useState<string[] | null>(null);

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
      if (libraryGenre && !hasTag(t.genres ?? [], libraryGenre)) return false;
      if (f === 'favorites' && !t.favorite) return false;
      if (f !== 'all' && f !== 'favorites' && trackStatus(t) !== f) return false;
      return !q || t.title.toLocaleLowerCase().includes(q) || (t.album ?? '').toLocaleLowerCase().includes(q);
    });
  }, [sorted, settings.filter, query, libraryGenre]);
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
      if (!t.audioPath) return;
      const path = t.audioPath;
      void engine.load(id, () => audioUrl(path).catch(() => null), { position: opts.at ?? (t.finished ? 0 : t.position), autoplay });
      lsSet(lastKey, id);
    },
    [engine, lib.tracksRef, lastKey, setQueue],
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
      duration: (id, d) => {
        // Admins backfill a missing duration into the catalogue the first time it's played.
        const t = lib.tracksRef.current.find((x) => x.id === id);
        if (account.isAdmin && t && t.duration == null) updateTrack(id, { duration: Math.round(d * 10) / 10 }).catch(() => {});
      },
      started: lib.markPlayed,
      listened: lib.addListening,
      next: goNext,
      prev: goPrev,
      notify: showToast,
    };
  }, [engine, lib.savePosition, lib.tracksRef, account.isAdmin, lib.markPlayed, lib.addListening, goNext, goPrev, showToast]);

  useEffect(() => {
    engine.skipBack = settings.skipBack;
    engine.skipForward = settings.skipForward;
    engine.autoRewind = settings.autoRewind;
    engine.shakeToExtend = settings.shakeToExtend;
    engine.setEffects({ volume: settings.volume, eq: settings.eq, skipSilence: settings.skipSilence, voiceClarity: settings.voiceClarity });
  }, [engine, settings.skipBack, settings.skipForward, settings.autoRewind, settings.shakeToExtend, settings.volume, settings.eq, settings.skipSilence, settings.voiceClarity]);

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

  /* ------------------------------------------------------------ queue */

  const playNext = (id: string) => setQueue((q) => [id, ...q.filter((x) => x !== id)]);
  const toggleQueue = (id: string) => setQueue((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]));
  // Drop queue entries for tracks that no longer exist.
  useEffect(() => {
    if (lib.loaded) setQueue((q) => (q.every((id) => trackMap.has(id)) ? q : q.filter((id) => trackMap.has(id))));
  }, [lib.loaded, trackMap, setQueue]);

  /** Admin only: remove a story from the server for everyone. */
  const deleteTrack = async (id: string) => {
    const t = trackMap.get(id);
    if (!t) return;
    if (engine.state.trackId === id) {
      engine.unload();
      setNowOpen(false);
    }
    try {
      await deleteFromServer({ id, audioPath: t.audioPath ?? '', coverPath: t.coverPath ?? null });
      showToast(`সার্ভার থেকে মুছে ফেলা হয়েছে · Deleted “${t.title}”`);
    } catch (e) {
      showToast(describeAuthError(e));
    }
  };
  const adminPatch = (id: string, patch: Parameters<typeof updateTrack>[1], done: string) =>
    updateTrack(id, patch).then(
      () => showToast(done),
      (e) => showToast(describeAuthError(e)),
    );

  const trackBookmarks = useCallback((id: string) => lib.bookmarks.filter((b) => b.trackId === id && !b.deleted), [lib.bookmarks]);
  const savedSeconds = useMemo(() => [...lib.stats.values()].reduce((s, d) => s + d.savedSeconds, 0), [lib.stats]);

  const value: ShellValue = {
    store,
    profile,
    account,
    catalogError: catalog.error,
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
    toast: showToast,
    openAdmin: () => {
      setTab('admin');
      window.scrollTo({ top: 0 });
    },
    genreSelection,
    setGenreSelection,
    openGenre: (sel) => {
      setGenreSelection(sel);
      setTab('genres');
      window.scrollTo({ top: 0 });
    },
    libraryGenre,
    setLibraryGenre,
  };

  const storageWarning =
    store.mode === 'memory'
      ? 'এই ব্রাউজারে স্থানীয় স্টোরেজ পাওয়া যাচ্ছে না (প্রাইভেট মোড?) — অগ্রগতি শুধু আপনার অ্যাকাউন্টে sync হলে থাকবে।'
      : storageError
        ? 'এই ডিভাইসের সংরক্ষিত তথ্য পড়া যায়নি · Could not read data saved on this device.'
        : catalog.error
          ? `গল্পের তালিকা আনা যায়নি · ${catalog.error}`
          : lib.writeError
            ? 'কিছু পরিবর্তন সেভ হয়নি · Some changes could not be saved on this device.'
            : null;

  const sheetTrack = sheet && 'id' in sheet ? trackMap.get(sheet.id) : currentTrack;

  return (
    <ShellContext.Provider value={value}>
      <div className={`app${currentTrack ? ' has-player' : ''}${nowOpen || sheet ? ' modal-open' : ''}`}>

        {storageWarning && !bannerDismissed && (
          <div className="banner" role="alert">
            <span>{storageWarning}</span>
            <button type="button" className="btn ghost sm" onClick={() => setBannerDismissed(true)}>
              ঠিক আছে
            </button>
          </div>
        )}

        <Watermark />
        <main className="content" inert={nowOpen || sheet != null}>
          {tab === 'home' && <HomeView />}
          {tab === 'library' && <LibraryView />}
          {tab === 'genres' && <GenresView />}
          {tab === 'bookmarks' && <BookmarksView />}
          {tab === 'settings' && <SettingsView />}
          {tab === 'admin' && account.isAdmin && <AdminView />}
        </main>

        <div className="dock" inert={nowOpen || sheet != null}>
          {currentTrack && <MiniPlayer track={currentTrack} coverUrl={coverUrl} skipForward={settings.skipForward} onOpen={() => setNowOpen(true)} />}
          <nav className={`tabbar${account.isAdmin ? ' six' : ''}`} aria-label="Sections">
            {(
              [
                ['home', 'হোম', HomeIcon],
                ['library', 'লাইব্রেরি', LibraryIcon],
                ['genres', 'ধরন', MasksIcon],
                ['bookmarks', 'বুকমার্ক', BookmarkIcon],
                ['settings', 'সেটিংস', GearIcon],
                ...(account.isAdmin ? ([['admin', 'অ্যাডমিন', ShieldIcon]] as const) : []),
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
            effectsOn={settings.skipSilence || settings.voiceClarity}
            eqOn={settings.eq.some((g) => g !== 0)}
            volume={settings.volume}
            onVolume={(percent) => updateSettings({ volume: percent / 100 })}
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
            admin={
              account.isAdmin
                ? {
                    onGenres: () => setTimeout(() => setSheet({ kind: 'genres', id: sheetTrack.id })),
                    onRename: (title) => void adminPatch(sheetTrack.id, { title: title.trim() }, 'নাম বদলানো হয়েছে · Renamed'),
                    onTogglePublish: () =>
                      void adminPatch(sheetTrack.id, { published: !sheetTrack.published }, sheetTrack.published ? 'লুকানো হয়েছে · Hidden from listeners' : 'প্রকাশিত · Published'),
                    onDelete: () => void deleteTrack(sheetTrack.id),
                  }
                : undefined
            }
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
              setSheet(null);
              void adminPatch(sheetTrack.id, { genres: tags }, 'ধরন সেভ হয়েছে · Genres saved');
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
        {sheet?.kind === 'eq' && <EqualizerSheet gains={settings.eq} onChange={(eq) => updateSettings({ eq })} onClose={() => setSheet(null)} />}
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
