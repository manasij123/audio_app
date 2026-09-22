import { getEngine, useEngine } from '../lib/engine';
import { formatDuration } from '../lib/format';
import type { Track } from '../lib/types';
import { Cover } from './Cover';
import { PauseIcon, PlayIcon, SkipIcon } from './Icons';

export function MiniPlayer({ track, coverUrl, skipForward, onOpen }: { track: Track; coverUrl?: string; skipForward: number; onOpen(): void }) {
  const engine = getEngine();
  const playing = useEngine((s) => s.playing);
  const loading = useEngine((s) => s.loading);
  const time = useEngine((s) => s.time);
  const duration = useEngine((s) => s.duration || track.duration || 0);
  const rate = useEngine((s) => s.rate);
  const sleepRemaining = useEngine((s) => s.sleepRemaining);
  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="mini" role="region" aria-label="Now playing">
      <span className="mini-progress" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </span>
      <button type="button" className="mini-open" onClick={onOpen} aria-label={`Open player: ${track.title}`}>
        <Cover url={coverUrl} title={track.title} size="xs" />
        <span className="mini-text">
          <span className="mini-title">{track.title}</span>
          <span className="mini-sub">
            {loading ? 'লোড হচ্ছে…' : duration ? `${formatDuration((duration - time) / rate)} বাকি` : ' '}
            {sleepRemaining != null && ` · ☾ ${formatDuration(sleepRemaining)}`}
          </span>
        </span>
      </button>
      <button type="button" className="ctrl sm" onClick={() => engine.toggle()} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button type="button" className="ctrl sm" onClick={() => engine.skip(skipForward)} aria-label={`Forward ${skipForward} seconds`}>
        <SkipIcon dir="forward" seconds={skipForward} />
      </button>
    </div>
  );
}
