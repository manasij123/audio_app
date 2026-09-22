import { useCallback, useMemo, useState } from 'react';
import { ImportButtons, ImportProgressBar } from '../components/ImportButtons';
import { CloseIcon, SearchIcon, SortIcon } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { genreStyle, GenreIcon } from '../components/GenreMark';
import { TrackRow } from '../components/TrackRow';
import { GENRES } from '../lib/genres';
import { formatBytes } from '../lib/format';
import { trackStatus, type Filter, type SortKey } from '../lib/types';
import { useShell } from '../shellContext';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'সব' },
  { value: 'favorites', label: '★ প্রিয়' },
  { value: 'progress', label: 'চলছে' },
  { value: 'new', label: 'নতুন' },
  { value: 'finished', label: 'শোনা শেষ' },
];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'number', label: 'পর্ব নম্বর · Episode number' },
  { value: 'title', label: 'নাম · Title (A–Z)' },
  { value: 'added', label: 'সম্প্রতি যোগ · Recently added' },
  { value: 'played', label: 'সম্প্রতি শোনা · Recently played' },
  { value: 'length', label: 'দৈর্ঘ্য · Length' },
];

export function LibraryView() {
  const { lib, settings, updateSettings, visible, query, setQuery, queue, currentId, playing, play, openMenu, libraryGenre, setLibraryGenre } = useShell();
  const { tracks, coverUrls } = lib;
  const [sortOpen, setSortOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: tracks.length, favorites: 0, progress: 0, new: 0, finished: 0 };
    for (const t of tracks) {
      if (t.favorite) c.favorites++;
      c[trackStatus(t)]++;
    }
    return c;
  }, [tracks]);
  const totalBytes = useMemo(() => tracks.reduce((s, t) => s + t.sizeBytes, 0), [tracks]);
  const queued = useMemo(() => new Set(queue), [queue]);
  const ids = useMemo(() => visible.map((t) => t.id), [visible]);
  const playHere = useCallback((id: string) => play(id, { context: ids }), [play, ids]);

  return (
    <div className="view library">
      <header className="view-head row-head">
        <div>
          <h1>লাইব্রেরি</h1>
          <p className="summary">
            {tracks.length} episodes · {formatBytes(totalBytes)} on this device
          </p>
        </div>
        <ImportButtons compact />
      </header>
      <ImportProgressBar />

      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <input id="search" type="search" placeholder="খুঁজুন · Search titles" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search titles" />
          {query && (
            <button type="button" className="icon-btn xs" onClick={() => setQuery('')} aria-label="Clear search">
              <CloseIcon />
            </button>
          )}
        </label>
        <button type="button" className="icon-btn boxed" onClick={() => setSortOpen(true)} aria-label="Sort">
          <SortIcon />
        </button>
      </div>
      <div className="chips genre-chips" role="radiogroup" aria-label="Genre">
        <button type="button" role="radio" aria-checked={!libraryGenre} className={`chip${!libraryGenre ? ' on' : ''}`} onClick={() => setLibraryGenre(null)}>
          সব ধরন
        </button>
        {GENRES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={libraryGenre === g.id}
            className={`chip genre-chip${libraryGenre === g.id ? ' on' : ''}`}
            style={genreStyle(g.id)}
            onClick={() => setLibraryGenre(libraryGenre === g.id ? null : g.id)}
          >
            <GenreIcon id={g.id} /> {g.name}
          </button>
        ))}
      </div>
      <div className="chips" role="radiogroup" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={settings.filter === f.value} className={`chip${settings.filter === f.value ? ' on' : ''}`} onClick={() => updateSettings({ filter: f.value })}>
            {f.label} <span className="chip-count">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="empty-note center">
          {query ? 'কিছু পাওয়া যায়নি · No matches' : settings.filter === 'favorites' ? 'এখনও কোনো প্রিয় নেই — কোনো পর্বের ☆ চাপুন।' : 'এই তালিকায় কিছু নেই · Nothing here yet'}
        </p>
      ) : (
        <ul className="list">
          {visible.map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              coverUrl={coverUrls.get(t.id)}
              isCurrent={currentId === t.id}
              isPlaying={currentId === t.id && playing}
              queued={queued.has(t.id)}
              onPlay={playHere}
              onToggleFavorite={lib.toggleFavorite}
              onMore={openMenu}
            />
          ))}
        </ul>
      )}

      {sortOpen && (
        <Sheet title="সাজান · Sort by" onClose={() => setSortOpen(false)}>
          <ul className="menu-list radio">
            {SORTS.map((s) => (
              <li key={s.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.sort === s.value}
                  className={settings.sort === s.value ? 'on' : ''}
                  data-autofocus={settings.sort === s.value || undefined}
                  onClick={() => {
                    updateSettings({ sort: s.value });
                    setSortOpen(false);
                  }}
                >
                  <span className="radio-dot" aria-hidden /> {s.label}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
