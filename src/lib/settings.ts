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
  /** Volume gain, 1 = off. */
  boost: number;
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
  boost: 1,
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
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
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
