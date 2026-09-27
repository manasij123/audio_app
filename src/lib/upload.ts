import { guessMime, isAudioFile, titleFromFileName, trackNoFromFileName } from './filename';
import { detectGenres } from './genres';
import { parseTrackNumber, readTags, type Id3Tags } from './id3';
import type { Chapter } from './types';

/** One file prepared for upload: everything read from it in the browser before it goes to the server. */
export interface PendingUpload {
  key: string;
  file: File;
  sourcePath: string;
  tags: Id3Tags;
  title: string;
  trackNo: number | null;
  genres: string[];
  chapters: Chapter[];
  duration: number | null;
  mimeType: string;
  duplicate: boolean;
  status: 'ready' | 'uploading' | 'done' | 'skipped' | 'failed';
  progress: number;
  error?: string;
}

/** Duration from the file's own metadata, via a throwaway <audio> element. */
export function probeDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => {
      clearTimeout(timer);
      a.removeAttribute('src');
      a.load();
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 15000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration * 10) / 10 : null);
    a.onerror = () => done(null);
    a.src = url;
  });
}

/** Read tags, genres and duration for each picked audio file; flag ones already on the server. */
export async function prepareUploads(
  files: File[],
  existing: { sourcePath: string; fileName: string; sizeBytes: number }[],
  onEach?: (done: number, total: number) => void,
): Promise<PendingUpload[]> {
  const audio = files.filter(isAudioFile);
  const bySource = new Set(existing.map((e) => e.sourcePath));
  const byNameSize = new Set(existing.map((e) => `${e.fileName}|${e.sizeBytes}`));
  const out: PendingUpload[] = [];
  for (let i = 0; i < audio.length; i++) {
    const file = audio[i];
    onEach?.(i, audio.length);
    const rel = file.webkitRelativePath || file.name;
    const sourcePath = rel.includes('/') ? rel.slice(rel.indexOf('/') + 1) : rel;
    let tags: Id3Tags = {};
    try {
      tags = await readTags(file);
    } catch {
      /* untagged file */
    }
    const title = tags.title || titleFromFileName(file.name);
    out.push({
      key: `${sourcePath}|${file.size}|${i}`,
      file,
      sourcePath,
      tags,
      title,
      trackNo: parseTrackNumber(tags.track) ?? trackNoFromFileName(file.name),
      genres: detectGenres(title, tags.album, rel),
      chapters: (tags.chapters ?? []).map((c, n) => ({ start: c.start, title: c.title || `অধ্যায় ${n + 1}` })),
      duration: await probeDuration(file),
      mimeType: guessMime(file),
      duplicate: bySource.has(sourcePath) || byNameSize.has(`${file.name}|${file.size}`),
      status: 'ready',
      progress: 0,
    });
  }
  onEach?.(audio.length, audio.length);
  return out;
}
