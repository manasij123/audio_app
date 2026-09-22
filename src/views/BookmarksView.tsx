import { useMemo } from 'react';
import { Cover } from '../components/Cover';
import { PlayIcon, TrashIcon } from '../components/Icons';
import { formatAgo, formatTime } from '../lib/format';
import type { Bookmark, Track } from '../lib/types';
import { useShell } from '../shellContext';

export function BookmarksView() {
  const { lib, play } = useShell();
  const groups = useMemo(() => {
    const byTrack = new Map<string, Bookmark[]>();
    for (const b of lib.bookmarks) {
      if (b.deleted) continue;
      const list = byTrack.get(b.trackId) ?? [];
      list.push(b);
      byTrack.set(b.trackId, list);
    }
    const trackMap = new Map(lib.tracks.map((t) => [t.id, t]));
    return [...byTrack.entries()]
      .map(([id, list]) => ({ track: trackMap.get(id), list: list.sort((a, b) => a.time - b.time), latest: Math.max(...list.map((b) => b.createdAt)) }))
      .filter((g): g is { track: Track; list: Bookmark[]; latest: number } => !!g.track)
      .sort((a, b) => b.latest - a.latest);
  }, [lib.bookmarks, lib.tracks]);

  return (
    <div className="view bookmarks">
      <header className="view-head">
        <h1>বুকমার্ক</h1>
        <p className="summary">প্রিয় মুহূর্তগুলো · Moments you saved</p>
      </header>
      {groups.length === 0 ? (
        <div className="empty-state">
          <p>
            এখনও কোনো বুকমার্ক নেই। প্লেয়ার খুলে <strong>বুকমার্ক</strong> বোতাম চাপলে সেই মুহূর্তটা এখানে জমা থাকবে — পরে এক ট্যাপে ঠিক সেখান থেকে শুনতে পারবেন।
          </p>
        </div>
      ) : (
        groups.map(({ track, list }) => (
          <section key={track.id} className="bm-group">
            <header>
              <Cover url={lib.coverUrls.get(track.id)} title={track.title} size="xs" />
              <h2>{track.title}</h2>
            </header>
            <ul className="bm-list">
              {list.map((b) => (
                <li key={b.id}>
                  <button type="button" className="bm-main" onClick={() => play(track.id, { at: b.time })}>
                    <span className="bm-time">
                      <PlayIcon /> {formatTime(b.time)}
                    </span>
                    <span className="bm-note">{b.note || <em>নোট নেই</em>}</span>
                    <span className="bm-ago">{formatAgo(b.createdAt)}</span>
                  </button>
                  <button type="button" className="icon-btn" onClick={() => lib.deleteBookmark(b.id)} aria-label="Delete bookmark">
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
