import { memo } from 'react';
import { formatDuration, formatTime } from '../lib/format';
import { trackStatus, type Track } from '../lib/types';
import { Cover } from './Cover';
import { MoreIcon, StarIcon } from './Icons';

interface Props {
  track: Track;
  coverUrl?: string;
  isCurrent: boolean;
  isPlaying: boolean;
  queued: boolean;
  onPlay(id: string): void;
  onToggleFavorite(id: string): void;
  onMore(id: string): void;
}

export function StatusLabel({ track }: { track: Track }) {
  const status = trackStatus(track);
  if (status === 'finished') return <span className="pill done">✓ শোনা শেষ</span>;
  if (status === 'progress') {
    const left = track.duration ? track.duration - track.position : null;
    return <span className="pill progress">{left != null ? `${formatDuration(left)} বাকি` : `▶ ${formatTime(track.position)}`}</span>;
  }
  return <span className="pill new">নতুন</span>;
}

export const TrackRow = memo(function TrackRow({ track, coverUrl, isCurrent, isPlaying, queued, onPlay, onToggleFavorite, onMore }: Props) {
  const { duration, position } = track;
  const pct = duration && position > 0 && !track.finished ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <li className={`row${isCurrent ? ' is-current' : ''}`}>
      <button type="button" className="row-main" onClick={() => onPlay(track.id)} aria-current={isCurrent || undefined}>
        <span className="row-art">
          <Cover url={coverUrl} title={track.title} size="sm" />
          {isCurrent && (
            <span className={`eq${isPlaying ? ' on' : ''}`} aria-hidden>
              <i />
              <i />
              <i />
            </span>
          )}
        </span>
        <span className="row-info">
          <span className="row-title">{track.title}</span>
          <span className="row-meta">
            {track.trackNo != null && <span className="row-no">#{track.trackNo}</span>}
            <span>{formatTime(duration)}</span>
            <StatusLabel track={track} />
            {queued && <span className="pill queued">পরের তালিকায়</span>}
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
        aria-label={track.favorite ? `Remove ${track.title} from favourites` : `Add ${track.title} to favourites`}
      >
        <StarIcon filled={track.favorite} />
      </button>
      <button type="button" className="icon-btn" onClick={() => onMore(track.id)} aria-label={`More actions for ${track.title}`}>
        <MoreIcon />
      </button>
    </li>
  );
});
