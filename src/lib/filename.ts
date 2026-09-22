const AUDIO_EXT = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|webm|weba)$/i;

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  webm: 'audio/webm',
  weba: 'audio/webm',
};

export function isAudioFile(file: { name: string; type: string }): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXT.test(file.name);
}

export function guessMime(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'audio/mpeg';
}

/**
 * Stable id for a file: its path relative to the picked folder (the picked
 * folder's own name is dropped, so re-importing a renamed/moved copy of the
 * same folder still dedupes), or just the file name for loose files.
 */
export function trackIdFor(file: { name: string; webkitRelativePath?: string }): string {
  const rel = file.webkitRelativePath ?? '';
  const slash = rel.indexOf('/');
  return slash >= 0 ? rel.slice(slash + 1) : file.name;
}

const TRACK_MARKER = /^#\s*(\d+)\s*#\s*/;

/**
 * Human title from a file name like "#12# Sunday Suspense - Feluda [dQw4w9WgXcQ] (128k).mp3"
 * → "Sunday Suspense - Feluda".
 */
export function titleFromFileName(name: string): string {
  let s = name.replace(/\.[^./]+$/, '');
  s = s.replace(TRACK_MARKER, '');
  // Strip "(128k)" / "(320 kbps)" style bitrate suffixes and trailing "[videoId]" brackets,
  // in whatever order they appear at the end.
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(/\s*[([]\s*\d+\s*k(?:bps)?\s*[)\]]\s*$/i, '')
      .replace(/\s*\[[A-Za-z0-9_-]{6,}\]\s*$/, '');
  }
  s = s.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return s || name;
}

/** Track number from a leading "#N#" marker, if present. */
export function trackNoFromFileName(name: string): number | null {
  const m = TRACK_MARKER.exec(name);
  return m ? parseInt(m[1], 10) : null;
}
