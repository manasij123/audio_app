import { useState, type CSSProperties } from 'react';
import { getEngine, useEngine } from '../lib/engine';
import { formatTime } from '../lib/format';

interface Props {
  /** Positions (seconds) drawn as ticks: chapter starts and bookmarks. */
  chapterMarks?: number[];
  bookmarkMarks?: number[];
}

export function SeekBar({ chapterMarks = [], bookmarkMarks = [] }: Props) {
  const engine = getEngine();
  const time = useEngine((s) => s.time);
  const duration = useEngine((s) => s.duration);
  const rate = useEngine((s) => s.rate);
  const [scrub, setScrub] = useState<number | null>(null);

  const shown = scrub ?? time;
  const max = duration > 0 ? duration : Math.max(1, shown);
  const pct = (Math.min(shown, max) / max) * 100;
  const commit = (v: number) => {
    setScrub(null);
    engine.seek(v);
  };
  const left = duration > 0 ? (duration - shown) / rate : null;

  return (
    <div className="seekbar">
      <div className="seek-track">
        <input
          id="seek"
          type="range"
          className="seek"
          min={0}
          max={max}
          step={1}
          value={Math.min(shown, max)}
          style={{ '--pct': `${pct}%` } as CSSProperties}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={(e) => commit(Number(e.currentTarget.value))}
          onKeyUp={(e) => commit(Number(e.currentTarget.value))}
          onBlur={() => scrub != null && commit(scrub)}
          aria-label="Seek"
          aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
        />
        {duration > 0 && (
          <div className="seek-marks" aria-hidden>
            {chapterMarks.map((t) => (
              <i key={`c${t}`} className="mark-chapter" style={{ left: `${(t / duration) * 100}%` }} />
            ))}
            {bookmarkMarks.map((t, i) => (
              <i key={`b${i}`} className="mark-bookmark" style={{ left: `${(t / duration) * 100}%` }} />
            ))}
          </div>
        )}
      </div>
      <div className="seek-times">
        <span>{formatTime(shown)}</span>
        <span>{left != null ? `−${formatTime(left)}` : '--:--'}</span>
      </div>
    </div>
  );
}
