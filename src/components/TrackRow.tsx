import { memo, useEffect, useRef, useState } from 'react';
import { formatTime } from '../lib/format';
import type { Track } from '../lib/types';
import { Cover } from './Cover';
import { StarIcon, TrashIcon } from './Icons';

const CONFIRM_WINDOW_MS = 4000;

interface Props {
  track: Track;
  coverUrl?: string;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay(id: string): void;
  onToggleFavorite(id: string): void;
  onDelete(id: string): void;
}

export const TrackRow = memo(function TrackRow({ track, coverUrl, isCurrent, isPlaying, onPlay, onToggleFavorite, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleDelete = () => {
    clearTimeout(timer.current);
    if (confirming) {
      setConfirming(false);
      onDelete(track.id);
      return;
    }
    setConfirming(true);
    timer.current = window.setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
  };

  const { duration, position } = track;
  const pct = duration && position > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <li className={`row${isCurrent ? ' is-current' : ''}${confirming ? ' is-confirming' : ''}`}>
      <button type="button" className="row-main" onClick={() => onPlay(track.id)} aria-current={isCurrent || undefined}>
        <Cover url={coverUrl} className="cover-sm" />
        <span className="row-info">
          <span className="row-title">{track.title}</span>
          <span className="row-meta">
            {track.trackNo != null && <span className="row-no">#{track.trackNo}</span>}
            <span>{formatTime(duration)}</span>
            {isCurrent ? (
              <span className="row-now">{isPlaying ? '● বাজছে · playing' : 'paused'}</span>
            ) : position > 0 ? (
              <span className="row-resume">resume {formatTime(position)}</span>
            ) : null}
          </span>
          {pct > 0 && (
            <span className="row-progress" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        className={`icon-btn star${track.favorite ? ' on' : ''}`}
        onClick={() => onToggleFavorite(track.id)}
        aria-pressed={track.favorite}
        aria-label={track.favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <StarIcon filled={track.favorite} />
      </button>
      <button
        type="button"
        className={`icon-btn del${confirming ? ' confirm' : ''}`}
        onClick={handleDelete}
        aria-label={confirming ? `Tap again to delete ${track.title}` : `Delete ${track.title}`}
      >
        {confirming ? <span className="del-label">মুছবেন?</span> : <TrashIcon />}
      </button>
    </li>
  );
});
