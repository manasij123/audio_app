import { useEffect, useState, type CSSProperties } from 'react';
import { dominantColor, hashHue } from '../lib/art';
import { getEngine, useEngine } from '../lib/engine';
import { formatDuration, formatRate, formatTime } from '../lib/format';
import type { Bookmark, Track } from '../lib/types';
import { Cover } from './Cover';
import { BookmarkIcon, ChaptersIcon, ChevronDownIcon, GaugeIcon, MoonIcon, MoreIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, QueueIcon, SkipIcon, SlidersIcon, StarIcon } from './Icons';
import { SeekBar } from './SeekBar';

export type PlayerSheet = 'speed' | 'sleep' | 'effects' | 'queue' | 'chapters' | 'bookmarks';

interface Props {
  inert?: boolean;
  track: Track;
  coverUrl?: string;
  bookmarks: Bookmark[];
  queueLength: number;
  skipBack: number;
  skipForward: number;
  effectsOn: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose(): void;
  onPrev(): void;
  onNext(): void;
  onSheet(s: PlayerSheet): void;
  onMore(): void;
  onToggleFavorite(): void;
  onQuickBookmark(): void;
}

/** Full-screen player, tinted with the cover's colour. */
export function NowPlaying(p: Props) {
  const { track } = p;
  const engine = getEngine();
  const playing = useEngine((s) => s.playing);
  const time = useEngine((s) => s.time);
  const rate = useEngine((s) => s.rate);
  const sleepRemaining = useEngine((s) => s.sleepRemaining);
  const sleepTrack = useEngine((s) => s.sleep?.kind === 'track');
  const [rgb, setRgb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRgb(null);
    if (p.coverUrl) dominantColor(p.coverUrl).then((c) => !cancelled && c && setRgb(c.join(' ')));
    return () => {
      cancelled = true;
    };
  }, [p.coverUrl]);

  // Close on Escape / Android back gesture via history is out of scope; Escape for desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !p.inert && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const chapters = track.chapters;
  const chapterIndex = chapters.length ? chapters.findLastIndex((c) => c.start <= time + 0.5) : -1;
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : null;
  const style = (rgb ? { '--np-rgb': rgb } : { '--np-hue': hashHue(track.title) }) as unknown as CSSProperties;

  return (
    <div className={`np${rgb ? ' tinted' : ''}`} style={style} inert={p.inert} role="dialog" aria-modal="true" aria-label={`Now playing: ${track.title}`}>
      <header className="np-head">
        <button type="button" className="icon-btn" onClick={p.onClose} aria-label="Close player">
          <ChevronDownIcon />
        </button>
        <div className="np-context">
          <span>এখন শুনছেন</span>
          {track.album && <strong>{track.album}</strong>}
        </div>
        <button type="button" className="icon-btn" onClick={p.onMore} aria-label="More actions">
          <MoreIcon />
        </button>
      </header>

      <div className="np-art">
        <Cover url={p.coverUrl} title={track.title} size="xl" />
      </div>

      <div className="np-titles">
        <div>
          <h2 className="np-title">{track.title}</h2>
          <p className="np-sub">
            {[track.trackNo != null ? `পর্ব ${track.trackNo}` : null, track.artist].filter(Boolean).join(' · ') || 'শ্রুতি'}
          </p>
        </div>
        <button type="button" className={`icon-btn star${track.favorite ? ' on' : ''}`} onClick={p.onToggleFavorite} aria-pressed={track.favorite} aria-label="Favourite">
          <StarIcon filled={track.favorite} />
        </button>
      </div>

      {chapter && (
        <button type="button" className="np-chapter" onClick={() => p.onSheet('chapters')}>
          <ChaptersIcon /> {chapter.title} <span>
            {chapterIndex + 1}/{chapters.length}
          </span>
        </button>
      )}

      <SeekBar chapterMarks={chapters.map((c) => c.start).filter((s) => s > 0)} bookmarkMarks={p.bookmarks.map((b) => b.time)} />

      <div className="np-controls">
        <button type="button" className="ctrl" onClick={p.onPrev} disabled={!p.hasPrev} aria-label="Previous episode">
          <PrevIcon />
        </button>
        <button type="button" className="ctrl" onClick={() => engine.skip(-p.skipBack)} aria-label={`Back ${p.skipBack} seconds`}>
          <SkipIcon dir="back" seconds={p.skipBack} />
        </button>
        <button type="button" className="ctrl play" onClick={() => engine.toggle()} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className="ctrl" onClick={() => engine.skip(p.skipForward)} aria-label={`Forward ${p.skipForward} seconds`}>
          <SkipIcon dir="forward" seconds={p.skipForward} />
        </button>
        <button type="button" className="ctrl" onClick={p.onNext} disabled={!p.hasNext} aria-label="Next episode">
          <NextIcon />
        </button>
      </div>

      <nav className="np-actions" aria-label="Player options">
        <button type="button" onClick={() => p.onSheet('speed')} className={rate !== 1 ? 'active' : ''}>
          <GaugeIcon />
          <span>{formatRate(rate)}</span>
        </button>
        <button type="button" onClick={() => p.onSheet('sleep')} className={sleepRemaining != null || sleepTrack ? 'active' : ''}>
          <MoonIcon />
          <span>{sleepTrack ? 'পর্ব শেষে' : sleepRemaining != null ? formatTime(sleepRemaining) : 'ঘুম'}</span>
        </button>
        <button type="button" onClick={p.onQuickBookmark} onContextMenu={(e) => (e.preventDefault(), p.onSheet('bookmarks'))}>
          <BookmarkIcon />
          <span>চিহ্ন দিন</span>
        </button>
        {chapters.length > 0 ? (
          <button type="button" onClick={() => p.onSheet('chapters')}>
            <ChaptersIcon />
            <span>অধ্যায়</span>
          </button>
        ) : (
          <button type="button" onClick={() => p.onSheet('bookmarks')}>
            <BookmarkIcon filled={p.bookmarks.length > 0} />
            <span>বুকমার্ক {p.bookmarks.length || ''}</span>
          </button>
        )}
        <button type="button" onClick={() => p.onSheet('queue')} className={p.queueLength ? 'active' : ''}>
          <QueueIcon />
          <span>পরে {p.queueLength > 0 ? `(${p.queueLength})` : ''}</span>
        </button>
        <button type="button" onClick={() => p.onSheet('effects')} className={p.effectsOn ? 'active' : ''}>
          <SlidersIcon />
          <span>সাউন্ড</span>
        </button>
      </nav>
      {sleepRemaining != null && <p className="np-sleep-note">☾ ঘুমের টাইমার: {formatDuration(sleepRemaining)} পরে থামবে</p>}
    </div>
  );
}
