import type { Filter, SortKey } from './types';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
  skipBack: number;
  skipForward: number;
  /** Rewind a little when resuming after a pause, scaled by how long the pause was. */
  autoRewind: boolean;
  autoPlayNext: boolean;
  speed: number;
  /** Output volume, 0–3 (300%). 1 = unchanged. */
  volume: number;
  /** Graphic-EQ gains in dB, one per band in EQ_BANDS. */
  eq: number[];
  skipSilence: boolean;
  voiceClarity: boolean;
  shakeToExtend: boolean;
  sort: SortKey;
  filter: Filter;
  /** Minutes last used for the sleep timer. */
  lastSleepMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  skipBack: 15,
  skipForward: 15,
  autoRewind: true,
  autoPlayNext: true,
  speed: 1,
  volume: 1,
  eq: [0, 0, 0, 0, 0, 0],
  skipSilence: false,
  voiceClarity: false,
  shakeToExtend: true,
  sort: 'number',
  filter: 'all',
  lastSleepMinutes: 30,
};

const key = (profileId: string) => `shruti.settings.${profileId}`;

export function loadSettings(profileId: string): Settings {
  try {
    const raw = localStorage.getItem(key(profileId));
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings> & { boost?: number };
    // Older versions had a stepped "boost" instead of a volume knob.
    if (parsed.volume == null && typeof parsed.boost === 'number') parsed.volume = parsed.boost;
    delete parsed.boost;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(profileId: string, s: Settings) {
  try {
    localStorage.setItem(key(profileId), JSON.stringify(s));
  } catch {
    /* private mode — settings stay for this session */
  }
}

/** Small typed localStorage helpers for per-device conveniences. */
export function lsGet<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function lsSet(k: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
