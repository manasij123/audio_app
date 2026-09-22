export interface Chapter {
  /** Seconds from the start of the file. */
  start: number;
  title: string;
}

/**
 * Track metadata as held in memory and in the `tracks` object store.
 *
 * The two big binaries of a track (coverBlob, audioBlob) live in their own
 * object stores under the same id. Keeping them out of this record means the
 * frequent position saves (every few seconds while playing) only rewrite a few
 * hundred bytes instead of re-writing a 200 MB blob reference.
 */
export interface Track {
  id: string;
  title: string;
  album: string | null;
  artist: string | null;
  trackNo: number | null;
  sizeBytes: number;
  favorite: boolean;
  /** Resume position in seconds. */
  position: number;
  /** Seconds; null until probed. */
  duration: number | null;
  addedAt: number;
  fileName: string;
  mimeType: string;
  hasCover: boolean;
  /** Listened to the end (or marked as played). */
  finished: boolean;
  lastPlayedAt: number | null;
  chapters: Chapter[];
  /** Genre tags ("horror" or "horror.tantrik"); null = never classified (tracks from before genres existed). */
  genres: string[] | null;
}

/** Per-profile listening state for one track (the `progress` store). */
export interface Progress {
  profileId: string;
  trackId: string;
  position: number;
  favorite: boolean;
  finished: boolean;
  lastPlayedAt: number | null;
  /** For last-write-wins merging during cloud sync. */
  updatedAt: number;
}

export interface GoogleLink {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
}

export interface Profile {
  id: string;
  name: string;
  /** Avatar hue, 0-359. */
  hue: number;
  /** PBKDF2 hash of the PIN (hex), or null for no lock. */
  pinHash: string | null;
  pinSalt: string | null;
  createdAt: number;
  google: GoogleLink | null;
}

export interface Bookmark {
  id: string;
  profileId: string;
  trackId: string;
  /** Seconds. */
  time: number;
  note: string;
  createdAt: number;
  updatedAt: number;
  /** Tombstone so deletions survive cloud sync. */
  deleted?: boolean;
}

/** Listening time per local calendar day. */
export interface DayStats {
  profileId: string;
  day: string;
  seconds: number;
  /** Time saved by skip-silence. */
  savedSeconds: number;
}

export type Filter = 'all' | 'favorites' | 'new' | 'progress' | 'finished';
export type SortKey = 'number' | 'title' | 'added' | 'played' | 'length';

export type TrackStatus = 'new' | 'progress' | 'finished';

export function trackStatus(t: Track): TrackStatus {
  if (t.finished) return 'finished';
  return t.position > 0 ? 'progress' : 'new';
}

/** Fill fields added in later versions so older records keep working. */
export function normalizeTrack(t: Partial<Track> & Pick<Track, 'id' | 'title'>): Track {
  return {
    album: null,
    artist: null,
    trackNo: null,
    sizeBytes: 0,
    favorite: false,
    position: 0,
    duration: null,
    addedAt: 0,
    fileName: t.id,
    mimeType: 'audio/mpeg',
    hasCover: false,
    finished: false,
    lastPlayedAt: null,
    chapters: [],
    genres: null,
    ...t,
  };
}
