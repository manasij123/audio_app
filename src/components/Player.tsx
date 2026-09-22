import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react';
import type { LibraryStore } from '../lib/db';
import { formatTime } from '../lib/format';
import type { Track } from '../lib/types';
import { Cover } from './Cover';
import { Back15Icon, Fwd15Icon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from './Icons';

export const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.75];
const SKIP_SECONDS = 15;
/** Don't resume if the saved spot is within this many seconds of the end. */
const RESUME_TAIL_SECONDS = 10;
const SAVE_EVERY_MS = 5000;
const SPEED_KEY = 'shruti.speed';

export interface PlayerHandle {
  toggle(): void;
}

interface Props {
  ref?: Ref<PlayerHandle>;
  track: Track;
  coverUrl?: string;
  store: LibraryStore;
  /** Start playing as soon as the track is loaded (false when restoring the last track on app open). */
  autoplay: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev(): void;
  onNext(): void;
  onEnded(id: string): void;
  onSavePosition(id: string, seconds: number): void;
  onDuration(id: string, seconds: number): void;
  onPlayingChange(playing: boolean): void;
  onError(message: string): void;
}

function loadSpeedIndex(): number {
  try {
    const i = SPEEDS.indexOf(Number(localStorage.getItem(SPEED_KEY)));
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

export function Player(props: Props) {
  const { ref, track, coverUrl, store, hasPrev, hasNext } = props;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(track.position);
  const [duration, setDurationState] = useState(track.duration ?? 0);
  const [playing, setPlaying] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [speedIdx, setSpeedIdx] = useState(loadSpeedIndex);

  // Latest props for event handlers registered once / inside async flows.
  const latest = useRef(props);
  latest.current = props;
  const speedRef = useRef(SPEEDS[speedIdx]);
  speedRef.current = SPEEDS[speedIdx];

  /** Id of the track whose source is loaded, and whether its resume-seek has been applied. */
  const loadedId = useRef<string | null>(null);
  const ready = useRef(false);
  const playWhenReady = useRef(false);
  const lastSave = useRef(0);

  const save = () => {
    const a = audioRef.current;
    if (!a || !ready.current || !loadedId.current) return;
    lastSave.current = Date.now();
    latest.current.onSavePosition(loadedId.current, a.ended ? 0 : a.currentTime);
  };

  const updatePositionState = () => {
    const a = audioRef.current;
    if (!a || !('mediaSession' in navigator) || !Number.isFinite(a.duration)) return;
    try {
      navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate });
    } catch {
      /* unsupported */
    }
  };

  // Load the audio blob whenever the selected track changes.
  useEffect(() => {
    const a = audioRef.current!;
    const id = track.id;
    let cancelled = false;
    let url: string | null = null;
    ready.current = false;
    loadedId.current = id;
    playWhenReady.current = latest.current.autoplay;
    setTime(latest.current.track.position);
    setDurationState(latest.current.track.duration ?? 0);
    setScrub(null);

    (async () => {
      let blob: Blob | null = null;
      try {
        blob = await store.getAudio(id);
      } catch (e) {
        console.warn('[shruti] could not read audio', e);
      }
      if (cancelled) return;
      if (!blob) {
        latest.current.onError('এই ফাইলটি পাওয়া যাচ্ছে না · Audio data missing for this track');
        return;
      }
      url = URL.createObjectURL(blob);
      a.src = url;
      a.defaultPlaybackRate = speedRef.current;
      a.playbackRate = speedRef.current;
    })();

    return () => {
      cancelled = true;
      save(); // remember where the outgoing track was left
      ready.current = false;
      loadedId.current = null;
      a.pause();
      a.removeAttribute('src');
      a.load();
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, store]);

  const onLoadedMetadata = () => {
    const a = audioRef.current!;
    const id = loadedId.current;
    if (!id) return;
    const d = a.duration;
    if (Number.isFinite(d) && d > 0) {
      setDurationState(d);
      latest.current.onDuration(id, d);
    }
    const pos = latest.current.track.position;
    if (pos > 0 && (!Number.isFinite(d) || pos < d - RESUME_TAIL_SECONDS)) a.currentTime = pos;
    setTime(a.currentTime);
    ready.current = true;
    lastSave.current = Date.now();
    a.playbackRate = speedRef.current;
    updatePositionState();
    if (playWhenReady.current) {
      playWhenReady.current = false;
      a.play().catch((e) => console.warn('[shruti] play() rejected', e));
    }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current!;
    if (!ready.current) return;
    setTime(a.currentTime);
    if (!a.paused && Date.now() - lastSave.current >= SAVE_EVERY_MS) save();
  };

  const onEnded = () => {
    save(); // saves 0 because a.ended is true
    setTime(0);
    if (loadedId.current) latest.current.onEnded(loadedId.current);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (!ready.current) {
      playWhenReady.current = !playWhenReady.current;
      return;
    }
    if (a.paused) a.play().catch((e) => console.warn('[shruti] play() rejected', e));
    else a.pause();
  };

  const skip = (delta: number) => {
    const a = audioRef.current;
    if (!a || !ready.current) return;
    const end = Number.isFinite(a.duration) ? a.duration : Infinity;
    a.currentTime = Math.max(0, Math.min(end - 0.25, a.currentTime + delta));
    setTime(a.currentTime);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    const a = audioRef.current;
    if (a) {
      a.defaultPlaybackRate = SPEEDS[next];
      a.playbackRate = SPEEDS[next];
    }
    try {
      localStorage.setItem(SPEED_KEY, String(SPEEDS[next]));
    } catch {
      /* private mode */
    }
  };

  const commitScrub = (value: number) => {
    const a = audioRef.current;
    setScrub(null);
    if (!a || !ready.current) return;
    a.currentTime = value;
    setTime(value);
    save();
  };

  useImperativeHandle(ref, () => ({ toggle: togglePlay }));

  // Save when the page is hidden/closed (Android often kills backgrounded tabs).
  useEffect(() => {
    const onHide = () => save();
    const onVisibility = () => document.visibilityState === 'hidden' && save();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock-screen / notification controls.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist ?? 'Shruti',
        album: track.album ?? '',
        artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512' }] : [],
      });
    } catch {
      /* unsupported */
    }
  }, [track.title, track.artist, track.album, coverUrl]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => audioRef.current?.play().catch(() => {})],
      ['pause', () => audioRef.current?.pause()],
      ['previoustrack', () => latest.current.onPrev()],
      ['nexttrack', () => latest.current.onNext()],
      ['seekbackward', (d) => skip(-(d.seekOffset ?? SKIP_SECONDS))],
      ['seekforward', (d) => skip(d.seekOffset ?? SKIP_SECONDS)],
      [
        'seekto',
        (d) => {
          const a = audioRef.current;
          if (a && ready.current && d.seekTime != null) {
            a.currentTime = d.seekTime;
            setTime(d.seekTime);
          }
        },
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* action unsupported */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desktop keyboard shortcuts: space = play/pause, ←/→ = ∓15s.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || el.closest('input, textarea, select, button, [contenteditable]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') skip(-SKIP_SECONDS);
      else if (e.key === 'ArrowRight') skip(SKIP_SECONDS);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = scrub ?? time;
  const max = duration > 0 ? duration : Math.max(1, shown);

  return (
    <section className="player" aria-label="Player">
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => {
          setPlaying(true);
          latest.current.onPlayingChange(true);
        }}
        onPause={() => {
          setPlaying(false);
          latest.current.onPlayingChange(false);
          save();
        }}
        onEnded={onEnded}
        onSeeked={updatePositionState}
        onRateChange={updatePositionState}
        onError={() => {
          if (loadedId.current && audioRef.current?.getAttribute('src')) {
            latest.current.onError('এই ফাইলটি চালানো যাচ্ছে না · This file could not be played');
          }
        }}
      />
      <div className="player-top">
        <Cover url={coverUrl} className="cover-md" />
        <div className="player-title" title={track.title}>
          <div className="player-name">{track.title}</div>
          {(track.album || track.artist) && <div className="player-sub">{track.album || track.artist}</div>}
        </div>
        <button type="button" className="speed-btn" onClick={cycleSpeed} aria-label={`Playback speed ${SPEEDS[speedIdx]}×, tap to change`}>
          {SPEEDS[speedIdx]}×
        </button>
      </div>
      <div className="player-seek">
        <span className="time">{formatTime(shown)}</span>
        <input
          type="range"
          className="seek"
          min={0}
          max={max}
          step={1}
          value={Math.min(shown, max)}
          style={{ '--pct': `${(Math.min(shown, max) / max) * 100}%` } as CSSProperties}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={(e) => commitScrub(Number(e.currentTarget.value))}
          onKeyUp={(e) => commitScrub(Number(e.currentTarget.value))}
          onBlur={() => scrub != null && commitScrub(scrub)}
          aria-label="Seek"
          aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
        />
        <span className="time">{formatTime(duration || null)}</span>
      </div>
      <div className="player-controls">
        <button type="button" className="ctrl" onClick={() => latest.current.onPrev()} disabled={!hasPrev} aria-label="Previous track">
          <PrevIcon />
        </button>
        <button type="button" className="ctrl" onClick={() => skip(-SKIP_SECONDS)} aria-label="Back 15 seconds">
          <Back15Icon />
        </button>
        <button type="button" className="ctrl play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className="ctrl" onClick={() => skip(SKIP_SECONDS)} aria-label="Forward 15 seconds">
          <Fwd15Icon />
        </button>
        <button type="button" className="ctrl" onClick={() => latest.current.onNext()} disabled={!hasNext} aria-label="Next track">
          <NextIcon />
        </button>
      </div>
    </section>
  );
}
