import { useSyncExternalStore } from 'react';

/** Don't resume if the saved spot is within this many seconds of the end. */
export const RESUME_TAIL_SECONDS = 10;
const SAVE_EVERY_MS = 5000;
const SLEEP_FADE_SECONDS = 10;
const SHAKE_EXTEND_MINUTES = 5;
const SILENCE_RMS = 0.008;
const SILENCE_MIN_MS = 350;
const SILENCE_RATE = 4;

export type SleepTimer = { kind: 'minutes'; endsAt: number } | { kind: 'track' } | null;

export interface EngineState {
  trackId: string | null;
  loading: boolean;
  ready: boolean;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  sleep: SleepTimer;
  /** Seconds left on a minutes sleep timer (counts only while playing). */
  sleepRemaining: number | null;
  error: string | null;
}

export interface Effects {
  boost: number;
  skipSilence: boolean;
  voiceClarity: boolean;
}

export interface EngineHooks {
  savePosition(id: string, seconds: number, finished: boolean): void;
  /** Natural end of a track (not when the sleep timer stopped it). */
  ended(id: string): void;
  duration(id: string, seconds: number): void;
  started(id: string): void;
  listened(seconds: number, savedSeconds: number): void;
  next(): void;
  prev(): void;
  notify(message: string): void;
}

export interface NowPlayingInfo {
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl?: string;
}

const INITIAL: EngineState = {
  trackId: null,
  loading: false,
  ready: false,
  playing: false,
  time: 0,
  duration: 0,
  rate: 1,
  sleep: null,
  sleepRemaining: null,
  error: null,
};

interface Graph {
  ctx: AudioContext;
  highpass: BiquadFilterNode;
  presence: BiquadFilterNode;
  gain: GainNode;
  compressor: DynamicsCompressorNode;
  analyser: AnalyserNode;
}

export class AudioEngine {
  readonly audio: HTMLAudioElement;
  state: EngineState = INITIAL;
  hooks: EngineHooks | null = null;
  skipBack = 15;
  skipForward = 15;
  autoRewind = true;
  shakeToExtend = true;

  private listeners = new Set<() => void>();
  private url: string | null = null;
  private loadToken = 0;
  private pendingPosition = 0;
  private playWhenReady = false;
  private lastSave = 0;
  private pausedAt: number | null = null;
  private lastTick: { wall: number; media: number } | null = null;

  private effects: Effects = { boost: 1, skipSilence: false, voiceClarity: false };
  private graph: Graph | null = null;
  private silenceTimer: number | undefined;
  private silentMs = 0;
  private skippingSilence = false;

  private sleepTimer: number | undefined;
  private sleepLastTick = 0;
  private lastShake = 0;

  constructor() {
    const a = (this.audio = document.createElement('audio'));
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', this.onLoadedMetadata);
    a.addEventListener('timeupdate', this.onTimeUpdate);
    a.addEventListener('play', () => this.set({ playing: true }));
    a.addEventListener('playing', () => this.startSilenceWatch());
    a.addEventListener('pause', this.onPause);
    a.addEventListener('ended', this.onEnded);
    a.addEventListener('seeked', () => this.updatePositionState());
    a.addEventListener('ratechange', () => this.updatePositionState());
    a.addEventListener('error', () => {
      if (this.state.trackId && a.getAttribute('src')) this.set({ error: 'এই ফাইলটি চালানো যাচ্ছে না · This file could not be played', loading: false });
    });
    window.addEventListener('pagehide', () => this.saveNow());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.saveNow());
    this.setupMediaSession();
  }

  /* ------------------------------------------------------------ state */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /* ---------------------------------------------------------- loading */

  /**
   * Load a track. `position` is where to resume; it is ignored when it falls
   * within the last few seconds of the track.
   */
  async load(id: string, getBlob: () => Promise<Blob | null>, opts: { position: number; autoplay: boolean }) {
    const token = ++this.loadToken;
    this.saveNow();
    this.releaseSource();
    this.pendingPosition = opts.position;
    this.playWhenReady = opts.autoplay;
    this.pausedAt = null;
    this.set({ trackId: id, loading: true, ready: false, playing: false, time: opts.position, duration: 0, error: null });

    let blob: Blob | null = null;
    try {
      blob = await getBlob();
    } catch (e) {
      console.warn('[shruti] could not read audio', e);
    }
    if (token !== this.loadToken) return;
    if (!blob) {
      this.set({ loading: false, error: 'এই ফাইলটি পাওয়া যাচ্ছে না · Audio data missing for this track' });
      return;
    }
    this.url = URL.createObjectURL(blob);
    this.audio.src = this.url;
    this.audio.defaultPlaybackRate = this.state.rate;
    this.audio.playbackRate = this.state.rate;
    if (opts.autoplay) this.resumeContext();
  }

  unload() {
    this.loadToken++;
    this.saveNow();
    this.releaseSource();
    this.setSleep(null);
    this.set({ ...INITIAL, rate: this.state.rate });
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }

  private releaseSource() {
    this.state = { ...this.state, ready: false };
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.lastTick = null;
  }

  private onLoadedMetadata = () => {
    const a = this.audio;
    const id = this.state.trackId;
    if (!id) return;
    const d = a.duration;
    const finite = Number.isFinite(d) && d > 0;
    if (finite) this.hooks?.duration(id, d);
    const pos = this.pendingPosition;
    if (pos > 0 && (!finite || pos < d - RESUME_TAIL_SECONDS)) a.currentTime = pos;
    a.playbackRate = this.state.rate;
    this.lastSave = Date.now();
    this.set({ ready: true, loading: false, duration: finite ? d : 0, time: a.currentTime });
    this.updatePositionState();
    if (this.playWhenReady) {
      this.playWhenReady = false;
      this.play();
    }
  };

  /* --------------------------------------------------------- playback */

  play() {
    if (!this.state.trackId) return;
    if (!this.state.ready) {
      this.playWhenReady = true;
      return;
    }
    const a = this.audio;
    if (this.autoRewind && this.pausedAt) {
      const gap = Date.now() - this.pausedAt;
      const back = gap > 3_600_000 ? 30 : gap > 300_000 ? 15 : gap > 30_000 ? 5 : 0;
      if (back) a.currentTime = Math.max(0, a.currentTime - back);
    }
    this.pausedAt = null;
    this.resumeContext();
    a.play()
      .then(() => this.state.trackId && this.hooks?.started(this.state.trackId))
      .catch((e) => console.warn('[shruti] play() rejected', e));
  }

  pause() {
    if (!this.state.ready) {
      this.playWhenReady = false;
      return;
    }
    this.audio.pause();
  }

  toggle() {
    if (this.state.playing || this.playWhenReady) this.pause();
    else this.play();
  }

  seek(seconds: number) {
    if (!this.state.ready) return;
    const a = this.audio;
    const end = Number.isFinite(a.duration) ? a.duration : Infinity;
    a.currentTime = Math.max(0, Math.min(end - 0.25, seconds));
    this.set({ time: a.currentTime });
    this.saveNow();
  }

  skip(delta: number) {
    this.seek(this.audio.currentTime + delta);
  }

  setRate(rate: number) {
    const r = Math.round(Math.max(0.5, Math.min(3, rate)) * 100) / 100;
    this.audio.defaultPlaybackRate = r;
    if (!this.skippingSilence) this.audio.playbackRate = r;
    this.set({ rate: r });
  }

  private onTimeUpdate = () => {
    const a = this.audio;
    if (!this.state.ready) return;
    this.set({ time: a.currentTime });

    // Listening stats: wall-clock time actually spent playing, plus time saved by skip-silence.
    if (!a.paused) {
      const now = performance.now();
      if (this.lastTick) {
        const wall = (now - this.lastTick.wall) / 1000;
        const media = a.currentTime - this.lastTick.media;
        if (wall > 0 && wall < 2 && media >= 0 && media < 10) {
          this.hooks?.listened(wall, Math.max(0, media / this.state.rate - wall));
        }
      }
      this.lastTick = { wall: now, media: a.currentTime };
      if (Date.now() - this.lastSave >= SAVE_EVERY_MS) this.saveNow();
    }
  };

  private onPause = () => {
    this.lastTick = null;
    this.stopSilenceWatch();
    this.set({ playing: false });
    if (!this.audio.ended) this.pausedAt = Date.now();
    this.saveNow();
  };

  private onEnded = () => {
    const id = this.state.trackId;
    if (!id) return;
    this.lastSave = Date.now();
    this.hooks?.savePosition(id, 0, true);
    this.set({ time: 0, playing: false });
    if (this.state.sleep?.kind === 'track') {
      this.setSleep(null);
      this.hooks?.notify('ঘুমের টাইমার শেষ · Sleep timer stopped playback');
      return;
    }
    this.hooks?.ended(id);
  };

  /** Persist the current position now (throttled saves happen automatically while playing). */
  saveNow() {
    const id = this.state.trackId;
    if (!id || !this.state.ready || this.audio.ended) return;
    this.lastSave = Date.now();
    this.hooks?.savePosition(id, this.audio.currentTime, false);
  }

  /* ------------------------------------------------------ sleep timer */

  setSleep(timer: { minutes: number } | 'track' | null) {
    clearInterval(this.sleepTimer);
    this.sleepTimer = undefined;
    window.removeEventListener('devicemotion', this.onMotion);
    this.audio.volume = 1;
    if (timer == null) {
      this.set({ sleep: null, sleepRemaining: null });
      return;
    }
    if (timer === 'track') {
      this.set({ sleep: { kind: 'track' }, sleepRemaining: null });
    } else {
      this.sleepLastTick = Date.now();
      this.set({ sleep: { kind: 'minutes', endsAt: Date.now() + timer.minutes * 60_000 }, sleepRemaining: timer.minutes * 60 });
      this.sleepTimer = window.setInterval(this.sleepTick, 500);
    }
    if (this.shakeToExtend) window.addEventListener('devicemotion', this.onMotion);
  }

  extendSleep(minutes: number) {
    const s = this.state.sleep;
    if (s?.kind !== 'minutes') return;
    this.audio.volume = 1;
    const endsAt = s.endsAt + minutes * 60_000;
    this.set({ sleep: { kind: 'minutes', endsAt }, sleepRemaining: (endsAt - Date.now()) / 1000 });
  }

  private sleepTick = () => {
    const s = this.state.sleep;
    if (s?.kind !== 'minutes') return;
    const now = Date.now();
    let endsAt = s.endsAt;
    // The timer only runs down while something is playing.
    if (!this.state.playing) endsAt += now - this.sleepLastTick;
    this.sleepLastTick = now;
    const remaining = (endsAt - now) / 1000;
    if (remaining <= 0) {
      this.pause();
      this.setSleep(null);
      this.hooks?.notify('ঘুমের টাইমার শেষ · Sleep timer paused playback');
      return;
    }
    this.audio.volume = remaining < SLEEP_FADE_SECONDS ? Math.max(0.05, remaining / SLEEP_FADE_SECONDS) : 1;
    this.set({ sleep: { kind: 'minutes', endsAt }, sleepRemaining: remaining });
  };

  private onMotion = (e: DeviceMotionEvent) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null || g.z == null) return;
    const force = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
    const now = Date.now();
    if (force < 14 || now - this.lastShake < 2000) return;
    this.lastShake = now;
    if (this.state.sleep?.kind === 'minutes') {
      this.extendSleep(SHAKE_EXTEND_MINUTES);
      navigator.vibrate?.(60);
      this.hooks?.notify(`ঘুমের টাইমার +${SHAKE_EXTEND_MINUTES} মিনিট · Sleep timer extended`);
    }
  };

  /* ---------------------------------------------------------- effects */

  setEffects(effects: Effects) {
    this.effects = effects;
    const needed = effects.boost > 1 || effects.skipSilence || effects.voiceClarity;
    if (!needed && !this.graph) return; // keep the plain <audio> path when nothing is on
    const g = this.ensureGraph();
    if (!g) return;
    const t = g.ctx.currentTime;
    g.gain.gain.setTargetAtTime(effects.boost, t, 0.05);
    g.highpass.frequency.setTargetAtTime(effects.voiceClarity ? 90 : 10, t, 0.05);
    g.presence.gain.setTargetAtTime(effects.voiceClarity ? 5 : 0, t, 0.05);
    // The compressor keeps boosted audio from clipping; neutral when boost is off.
    g.compressor.threshold.setTargetAtTime(effects.boost > 1 ? -20 : 0, t, 0.05);
    g.compressor.ratio.setTargetAtTime(effects.boost > 1 ? 4 : 1, t, 0.05);
    if (!effects.skipSilence) this.stopSilenceWatch();
    else if (this.state.playing) this.startSilenceWatch();
  }

  private ensureGraph(): Graph | null {
    if (this.graph) return this.graph;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(this.audio);
      const highpass = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 10 });
      const presence = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 2800, Q: 0.9, gain: 0 });
      const gain = new GainNode(ctx, { gain: 1 });
      const compressor = new DynamicsCompressorNode(ctx, { threshold: 0, ratio: 1, knee: 12, attack: 0.005, release: 0.2 });
      const analyser = new AnalyserNode(ctx, { fftSize: 1024 });
      src.connect(highpass).connect(presence).connect(gain).connect(compressor).connect(ctx.destination);
      src.connect(analyser);
      this.graph = { ctx, highpass, presence, gain, compressor, analyser };
      if (this.state.playing) this.resumeContext();
      return this.graph;
    } catch (e) {
      console.warn('[shruti] audio effects unavailable', e);
      this.hooks?.notify('এই ব্রাউজারে অডিও এফেক্ট চলবে না · Audio effects are not supported here');
      return null;
    }
  }

  private resumeContext() {
    if (this.graph?.ctx.state === 'suspended') this.graph.ctx.resume().catch(() => {});
  }

  private startSilenceWatch() {
    if (!this.effects.skipSilence || !this.graph || this.silenceTimer !== undefined) return;
    const buf = new Float32Array(this.graph.analyser.fftSize);
    this.silentMs = 0;
    this.silenceTimer = window.setInterval(() => {
      const g = this.graph;
      if (!g) return;
      g.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms < SILENCE_RMS) {
        this.silentMs += 100;
        if (this.silentMs >= SILENCE_MIN_MS && !this.skippingSilence) {
          this.skippingSilence = true;
          this.audio.playbackRate = Math.max(this.state.rate, SILENCE_RATE);
        }
      } else {
        this.silentMs = 0;
        if (this.skippingSilence) this.endSilenceSkip();
      }
    }, 100);
  }

  private stopSilenceWatch() {
    clearInterval(this.silenceTimer);
    this.silenceTimer = undefined;
    if (this.skippingSilence) this.endSilenceSkip();
  }

  private endSilenceSkip() {
    this.skippingSilence = false;
    this.audio.playbackRate = this.state.rate;
  }

  /* ---------------------------------------------------- media session */

  setNowPlaying(info: NowPlayingInfo | null) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = info
        ? new MediaMetadata({
            title: info.title,
            artist: info.artist ?? 'Shruti',
            album: info.album ?? '',
            artwork: info.coverUrl ? [{ src: info.coverUrl, sizes: '512x512' }] : [],
          })
        : null;
    } catch {
      /* unsupported */
    }
  }

  private setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => this.play()],
      ['pause', () => this.pause()],
      ['previoustrack', () => this.hooks?.prev()],
      ['nexttrack', () => this.hooks?.next()],
      ['seekbackward', (d) => this.skip(-(d.seekOffset ?? this.skipBack))],
      ['seekforward', (d) => this.skip(d.seekOffset ?? this.skipForward)],
      ['seekto', (d) => d.seekTime != null && this.seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* action unsupported */
      }
    }
  }

  private updatePositionState() {
    const a = this.audio;
    if (!('mediaSession' in navigator) || !Number.isFinite(a.duration)) return;
    try {
      navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: this.state.rate });
    } catch {
      /* unsupported */
    }
  }
}

let instance: AudioEngine | null = null;

export function getEngine(): AudioEngine {
  return (instance ??= new AudioEngine());
}

/** Subscribe a component to one derived value of the engine state (return primitives only). */
export function useEngine<T>(selector: (s: EngineState) => T): T {
  const engine = getEngine();
  return useSyncExternalStore(engine.subscribe, () => selector(engine.state));
}
