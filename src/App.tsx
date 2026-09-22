import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cover } from './components/Cover';
import { CloseIcon, FolderIcon, PlusIcon, SearchIcon } from './components/Icons';
import { Player, type PlayerHandle } from './components/Player';
import { TrackRow } from './components/TrackRow';
import { useDurationProbe } from './hooks/useDurationProbe';
import { useLibrary, type ImportResult } from './hooks/useLibrary';
import { formatBytes } from './lib/format';
import type { Filter, Track } from './lib/types';

const LAST_TRACK_KEY = 'shruti.lastTrack';
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareTracks(a: Track, b: Track): number {
  if (a.trackNo != null && b.trackNo != null && a.trackNo !== b.trackNo) return a.trackNo - b.trackNo;
  if (a.trackNo != null && b.trackNo == null) return -1;
  if (a.trackNo == null && b.trackNo != null) return 1;
  return collator.compare(a.title, b.title) || collator.compare(a.id, b.id);
}

function describeImport(r: ImportResult): string {
  if (r.noAudio) return 'কোনো অডিও ফাইল পাওয়া যায়নি · No audio files found in that selection';
  const parts = [`${r.added} new, ${r.skipped} already existed`];
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.quotaHit) parts.push('stopped: device storage is full');
  else if (r.lowSpaceWarning) parts.push('storage is nearly full');
  if (r.persisted === false) parts.push('browser may clear this data if space runs low');
  return parts.join(' · ');
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export default function App() {
  const lib = useLibrary();
  const { tracks, tracksRef, coverUrls, store } = lib;
  useDurationProbe(store, tracks, tracksRef, lib.setDuration);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [current, setCurrent] = useState<{ id: string; autoplay: boolean } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const playerRef = useRef<PlayerHandle>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // React doesn't know the non-standard attribute, so set it directly.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  const sorted = useMemo(() => [...tracks].sort(compareTracks), [tracks]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return sorted.filter((t) => (filter === 'all' || t.favorite) && (!q || t.title.toLocaleLowerCase().includes(q)));
  }, [sorted, filter, query]);
  const totalBytes = useMemo(() => tracks.reduce((s, t) => s + t.sizeBytes, 0), [tracks]);

  // Restore the last-played track (paused) once the library has loaded.
  const restored = useRef(false);
  useEffect(() => {
    if (!lib.loaded || restored.current) return;
    restored.current = true;
    const last = lsGet(LAST_TRACK_KEY);
    if (last && tracksRef.current.some((t) => t.id === last)) setCurrent({ id: last, autoplay: false });
  }, [lib.loaded, tracksRef]);

  const currentTrack = current ? tracks.find((t) => t.id === current.id) ?? null : null;

  // Navigation happens within the visible list; fall back to the full sorted
  // list when the current track is filtered out.
  const navList = useMemo(() => {
    if (!current) return visible;
    return visible.some((t) => t.id === current.id) ? visible : sorted;
  }, [visible, sorted, current]);
  const navIndex = current ? navList.findIndex((t) => t.id === current.id) : -1;
  const nav = useRef({ navList, navIndex });
  nav.current = { navList, navIndex };

  const select = useCallback((id: string, autoplay = true) => {
    setCurrent({ id, autoplay });
    lsSet(LAST_TRACK_KEY, id);
  }, []);

  const step = useCallback(
    (delta: number) => {
      const { navList, navIndex } = nav.current;
      const next = navList[navIndex + delta];
      if (navIndex >= 0 && next) select(next.id);
    },
    [select],
  );
  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);

  const handlePlay = useCallback(
    (id: string) => {
      if (current?.id === id) playerRef.current?.toggle();
      else select(id);
    },
    [current?.id, select],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const title = tracksRef.current.find((t) => t.id === id)?.title ?? '';
      if (current?.id === id) {
        setCurrent(null);
        setPlaying(false);
      }
      lib.removeTrack(id).then(() => showToast(`মুছে ফেলা হয়েছে · Deleted “${title}”`));
    },
    [current?.id, lib, showToast, tracksRef],
  );

  const handleFiles = async (input: HTMLInputElement | null) => {
    const files = input?.files ? Array.from(input.files) : [];
    if (input) input.value = ''; // allow re-picking the same folder later
    if (!files.length) return;
    const result = await lib.importFiles(files);
    showToast(describeImport(result));
  };

  const importing = lib.progress != null;
  const storageWarning = lib.storageError
    ? store?.mode === 'memory'
      ? 'এই ব্রাউজারে স্থায়ী স্টোরেজ পাওয়া যাচ্ছে না · Persistent storage is unavailable (private browsing?). Imports will only last until you close this tab.'
      : 'লাইব্রেরি লোড করা যায়নি · Could not read the saved library.'
    : lib.writeError
      ? 'কিছু পরিবর্তন সেভ হয়নি · Some changes (favorites/positions) could not be saved to this device.'
      : null;

  const importButtons = (
    <div className="import-actions">
      <button type="button" className="btn primary" onClick={() => folderInput.current?.click()} disabled={importing || !store}>
        <FolderIcon /> Import folder
      </button>
      <button type="button" className="btn" onClick={() => filesInput.current?.click()} disabled={importing || !store}>
        <PlusIcon /> Add files
      </button>
    </div>
  );

  return (
    <div className={`app${currentTrack ? ' has-player' : ''}`}>
      <input ref={folderInput} type="file" multiple accept="audio/*" hidden onChange={(e) => handleFiles(e.currentTarget)} />
      <input ref={filesInput} type="file" multiple accept="audio/*,.mp3,.m4a,.m4b" hidden onChange={(e) => handleFiles(e.currentTarget)} />

      <header className="header">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            শ্রু
          </div>
          <div>
            <h1>
              শ্রুতি <span className="brand-en">Shruti</span>
            </h1>
            <p className="summary">
              {lib.loaded ? `${tracks.length} episodes · ${formatBytes(totalBytes)} on this device` : 'লোড হচ্ছে… Loading…'}
            </p>
          </div>
        </div>
        {tracks.length > 0 && importButtons}
        {lib.progress && (
          <div className="progress" role="status" aria-live="polite">
            <div className="progress-text">
              <span>
                ইমপোর্ট হচ্ছে · Importing {Math.min(lib.progress.done + 1, lib.progress.total)}/{lib.progress.total}
              </span>
              <span className="progress-file">{lib.progress.current}</span>
            </div>
            <div className="bar">
              <i style={{ width: `${(lib.progress.done / Math.max(1, lib.progress.total)) * 100}%` }} />
            </div>
          </div>
        )}
      </header>

      {storageWarning && !bannerDismissed && (
        <div className="banner" role="alert">
          <span>{storageWarning}</span>
          <button type="button" className="icon-btn" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
            <CloseIcon />
          </button>
        </div>
      )}

      {lib.loaded && tracks.length === 0 ? (
        <section className="empty">
          <Cover className="cover-lg" />
          <h2>আপনার লাইব্রেরি খালি</h2>
          <p>
            Pick the folder that holds your audio stories — Sunday Suspense, Feluda, anything. Files are copied into this browser&rsquo;s own
            storage, so next time they&rsquo;re just here, even offline. Nothing is uploaded anywhere.
          </p>
          {importButtons}
          <p className="hint">If your phone won&rsquo;t let you pick a folder, use “Add files” and select all the files inside it.</p>
        </section>
      ) : (
        tracks.length > 0 && (
          <main>
            <div className="toolbar">
              <label className="search">
                <SearchIcon />
                <input type="search" placeholder="খুঁজুন · Search titles" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search titles" />
              </label>
              <div className="chips" role="radiogroup" aria-label="Filter">
                {(
                  [
                    ['all', 'সব · All'],
                    ['favorites', '★ প্রিয় · Favorites'],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} type="button" role="radio" aria-checked={filter === value} className={`chip${filter === value ? ' on' : ''}`} onClick={() => setFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {visible.length === 0 ? (
              <p className="no-results">{filter === 'favorites' && !query ? 'এখনও কোনো প্রিয় নেই · No favorites yet — tap ☆ on an episode.' : 'কিছু পাওয়া যায়নি · No matches'}</p>
            ) : (
              <ul className="list">
                {visible.map((t) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    coverUrl={coverUrls.get(t.id)}
                    isCurrent={current?.id === t.id}
                    isPlaying={current?.id === t.id && playing}
                    onPlay={handlePlay}
                    onToggleFavorite={lib.toggleFavorite}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </main>
        )
      )}

      {currentTrack && store && current && (
        <Player
          ref={playerRef}
          track={currentTrack}
          coverUrl={coverUrls.get(currentTrack.id)}
          store={store}
          autoplay={current.autoplay}
          hasPrev={navIndex > 0}
          hasNext={navIndex >= 0 && navIndex < navList.length - 1}
          onPrev={goPrev}
          onNext={goNext}
          onEnded={goNext}
          onSavePosition={lib.savePosition}
          onDuration={lib.setDuration}
          onPlayingChange={setPlaying}
          onError={showToast}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite" key={toast.key}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
