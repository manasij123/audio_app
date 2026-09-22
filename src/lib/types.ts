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
}

export type Filter = 'all' | 'favorites';
