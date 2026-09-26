import { useEffect, useState, type CSSProperties } from 'react';
import { dominantColor, hashHue } from '../lib/art';
import { getEngine, useEngine } from '../lib/engine';
import { formatDuration, formatRate, formatTime } from '../lib/format';
import { tagLabel } from '../lib/genres';
import type { Bookmark, Track } from '../lib/types';
import { BookmarkIcon, ChaptersIcon, ChevronDownIcon, GaugeIcon, MoonIcon, MoreIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, QueueIcon, SkipIcon, SlidersIcon, StarIcon } from './Icons';
import { SeekBar } from './SeekBar';
import { Turntable } from './skeuo/Turntable';
import { VolumeKnob } from './skeuo/VolumeKnob';

export type PlayerSheet = 'speed' | 'sleep' | 'effects' | 'queue' | 'chapters' | 'bookmarks' | 'eq';

interface Props {
  inert?: boolean;
  track: Track;
  coverUrl?: string;
  bookmarks: Bookmark[];
  queueLength: number;
  skipBack: number;
  skipForward: number;
  effectsOn: boolean;
  eqOn: boolean;
  volume: number;
  hasPrev: boolean;
  hasNext: boolean;
  onClose(): void;
  onPrev(): void;
  onNext(): void;
  onSheet(s: PlayerSheet): void;
  onMore(): void;
  onToggleFavorite(): void;
  onQuickBookmark(): void;
  onVolume(percent: number): void;
}

/**
 * Full-screen player, built like a piece of audio hardware (skeuomorphic):
 * a spinning record, a glowing display, metal transport keys, a volume knob
 * and a graphic equaliser. Tinted with the cover's colour.
 */
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !p.inert && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const chapters = track.chapters;
  const chapterIndex = chapters.length ? chapters.findLastIndex((c) => c.start <= time + 0.5) : -1;
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : null;
  const style = (rgb ? { '--np-rgb': rgb } : { '--np-hue': hashHue(track.title) }) as unknown as CSSProperties;
  const sub = [track.trackNo != null ? `পর্ব ${track.trackNo}` : null, ...(track.genres ?? []).slice(0, 2).map(tagLabel)].filter(Boolean).join(' · ');

  return (
    <div className={`np skeuo${rgb ? ' tinted' : ''}`} style={style} inert={p.inert} role="dialog" aria-modal="true" aria-label={`Now playing: ${track.title}`}>
      <header className="np-head">
        <button type="button" className="hw-key round" onClick={p.onClose} aria-label="Close player">
          <ChevronDownIcon />
        </button>
        <div className="np-context">
          <span>এখন শুনছেন</span>
          {track.album && <strong>{track.album}</strong>}
        </div>
        <button type="button" className="hw-key round" onClick={p.onMore} aria-label="More actions">
          <MoreIcon />
        </button>
      </header>

      <div className="deck">
        <Turntable coverUrl={p.coverUrl} title={track.title} playing={playing} />

        <div className="vfd">
          <div className="vfd-row">
            <span className={`vfd-led${playing ? ' on' : ''}`} aria-hidden />
            <div className="vfd-title" title={track.title}>
              <span className={track.title.length > 26 ? 'marquee' : ''}>{track.title}</span>
            </div>
            <button type="button" className={`vfd-star${track.favorite ? ' on' : ''}`} onClick={p.onToggleFavorite} aria-pressed={track.favorite} aria-label="Favourite">
              <StarIcon filled={track.favorite} />
            </button>
          </div>
          <div className="vfd-sub">
            {chapter ? (
              <button type="button" className="vfd-chapter" onClick={() => p.onSheet('chapters')}>
                ▸ {chapter.title} ({chapterIndex + 1}/{chapters.length})
              </button>
            ) : (
              sub || 'শ্রুতি'
            )}
            <span className="vfd-flags">
              {rate !== 1 && <span>{formatRate(rate)}</span>}
              {(sleepRemaining != null || sleepTrack) && <span>☾ {sleepTrack ? 'পর্ব শেষে' : formatDuration(sleepRemaining!)}</span>}
              {p.eqOn && <span>EQ</span>}
            </span>
          </div>
        </div>

        <SeekBar chapterMarks={chapters.map((c) => c.start).filter((s) => s > 0)} bookmarkMarks={p.bookmarks.map((b) => b.time)} />

        <div className="transport" role="group" aria-label="Transport">
          <button type="button" className="hw-key" onClick={p.onPrev} disabled={!p.hasPrev} aria-label="Previous episode">
            <PrevIcon />
          </button>
          <button type="button" className="hw-key" onClick={() => engine.skip(-p.skipBack)} aria-label={`Back ${p.skipBack} seconds`}>
            <SkipIcon dir="back" seconds={p.skipBack} />
          </button>
          <button type="button" className={`hw-key play${playing ? ' down' : ''}`} onClick={() => engine.toggle()} aria-label={playing ? 'Pause' : 'Play'}>
            <span className={`led${playing ? ' on' : ''}`} aria-hidden />
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="hw-key" onClick={() => engine.skip(p.skipForward)} aria-label={`Forward ${p.skipForward} seconds`}>
            <SkipIcon dir="forward" seconds={p.skipForward} />
          </button>
          <button type="button" className="hw-key" onClick={p.onNext} disabled={!p.hasNext} aria-label="Next episode">
            <NextIcon />
          </button>
        </div>

        <div className="deck-controls">
          <VolumeKnob value={Math.round(p.volume * 100)} onChange={p.onVolume} />
          <div className="deck-keys">
            <button type="button" className={`hw-key labeled${p.eqOn ? ' on' : ''}`} onClick={() => p.onSheet('eq')}>
              <span className="led" aria-hidden />
              <SlidersIcon />
              <span>ইকুয়ালাইজার</span>
            </button>
            <button type="button" className={`hw-key labeled${rate !== 1 ? ' on' : ''}`} onClick={() => p.onSheet('speed')}>
              <span className="led" aria-hidden />
              <GaugeIcon />
              <span>{formatRate(rate)}</span>
            </button>
            <button type="button" className={`hw-key labeled${sleepRemaining != null || sleepTrack ? ' on' : ''}`} onClick={() => p.onSheet('sleep')}>
              <span className="led" aria-hidden />
              <MoonIcon />
              <span>{sleepTrack ? 'পর্ব শেষে' : sleepRemaining != null ? formatTime(sleepRemaining) : 'ঘুম'}</span>
            </button>
            <button type="button" className={`hw-key labeled${p.effectsOn ? ' on' : ''}`} onClick={() => p.onSheet('effects')}>
              <span className="led" aria-hidden />
              <GaugeIcon className="flip" />
              <span>সাউন্ড</span>
            </button>
          </div>
        </div>

        <div className="deck-row" role="group" aria-label="More">
          <button type="button" className="hw-key sm" onClick={p.onQuickBookmark}>
            <BookmarkIcon /> চিহ্ন দিন
          </button>
          <button type="button" className="hw-key sm" onClick={() => p.onSheet('bookmarks')}>
            <BookmarkIcon filled={p.bookmarks.length > 0} /> বুকমার্ক {p.bookmarks.length || ''}
          </button>
          {chapters.length > 0 && (
            <button type="button" className="hw-key sm" onClick={() => p.onSheet('chapters')}>
              <ChaptersIcon /> অধ্যায়
            </button>
          )}
          <button type="button" className={`hw-key sm${p.queueLength ? ' on' : ''}`} onClick={() => p.onSheet('queue')}>
            <QueueIcon /> পরে {p.queueLength > 0 ? `(${p.queueLength})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
