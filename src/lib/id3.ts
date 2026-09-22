/**
 * Minimal client-side ID3 reader: ID3v2.2 / v2.3 / v2.4 (+ ID3v1 fallback).
 * Extracts title, album, artist, track number and the embedded cover picture.
 */

export interface Id3Picture {
  mime: string;
  type: number;
  data: Uint8Array<ArrayBuffer>;
}

export interface Id3Chapter {
  /** Seconds. */
  start: number;
  title?: string;
}

export interface Id3Tags {
  chapters?: Id3Chapter[];
  title?: string;
  album?: string;
  artist?: string;
  albumArtist?: string;
  track?: string;
  picture?: Id3Picture;
}

/** Tags larger than this are almost certainly corrupt; don't read them. */
const MAX_TAG_BYTES = 32 * 1024 * 1024;

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');
const utf16le = new TextDecoder('utf-16le');
const utf16be = new TextDecoder('utf-16be');

const synchsafe = (b: Uint8Array, o: number) =>
  ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

const uint32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

/** Reverse the unsynchronisation scheme: every 0xFF 0x00 becomes 0xFF. */
export function removeUnsync(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  let j = 0;
  for (let i = 0; i < b.length; i++) {
    out[j++] = b[i];
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, j);
}

/** Decode a string in one of the four ID3 text encodings. */
export function decodeText(bytes: Uint8Array, encoding: number): string {
  let s: string;
  switch (encoding) {
    case 1: // UTF-16 with BOM (default to LE when missing, like most writers)
      if (bytes[0] === 0xfe && bytes[1] === 0xff) s = utf16be.decode(bytes.subarray(2));
      else if (bytes[0] === 0xff && bytes[1] === 0xfe) s = utf16le.decode(bytes.subarray(2));
      else s = utf16le.decode(bytes);
      break;
    case 2:
      s = utf16be.decode(bytes);
      break;
    case 3:
      s = utf8.decode(bytes);
      break;
    default:
      s = latin1.decode(bytes);
  }
  // v2.4 allows several null-separated values; keep the first non-empty one.
  const first = s.split('\u0000').find((part) => part.trim() !== '');
  return (first ?? '').replace(/^﻿/, '').trim();
}

/** Index just past a string terminator starting at `from` for the given encoding. */
function afterTerminator(b: Uint8Array, from: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i + 2;
  } else {
    for (let i = from; i < b.length; i++) if (b[i] === 0) return i + 1;
  }
  return b.length;
}

function sniffImageMime(data: Uint8Array): string | null {
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png';
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif';
  if (ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 4) === 'WEBP') return 'image/webp';
  return null;
}

function parsePicture(fd: Uint8Array, version: number): Id3Picture | null {
  if (fd.length < 4) return null;
  const enc = fd[0];
  let p = 1;
  let mime: string;
  if (version === 2) {
    // PIC: 3-char image format ("JPG", "PNG")
    const fmt = ascii(fd, 1, 3).toLowerCase();
    mime = fmt === 'jpg' ? 'image/jpeg' : `image/${fmt}`;
    p = 4;
  } else {
    const end = afterTerminator(fd, 1, 0);
    mime = ascii(fd, 1, end - 1 - 1).toLowerCase().trim();
    p = end;
  }
  const type = fd[p++];
  p = afterTerminator(fd, p, enc); // skip description
  const data = fd.slice(p); // copy, so the whole tag buffer can be GC'd
  if (data.length < 8 || mime === '-->') return null; // "-->" = linked, not embedded
  const sniffed = sniffImageMime(data);
  if (sniffed) mime = sniffed;
  else if (mime === 'image/jpg' || mime === 'jpg' || mime === 'jpeg') mime = 'image/jpeg';
  else if (!mime.startsWith('image/')) mime = mime ? `image/${mime}` : 'image/jpeg';
  return { mime, type, data };
}

const FRAME_KEYS: Record<string, keyof Omit<Id3Tags, 'picture' | 'chapters'>> = {
  TIT2: 'title',
  TT2: 'title',
  TALB: 'album',
  TAL: 'album',
  TPE1: 'artist',
  TP1: 'artist',
  TPE2: 'albumArtist',
  TP2: 'albumArtist',
  TRCK: 'track',
  TRK: 'track',
};

const isFrameId = (s: string) => /^[A-Z0-9]{3,4}$/.test(s);

/** Walk the frames in `data` starting at `pos`, calling `onFrame` with each frame's decoded body. */
function iterateFrames(data: Uint8Array, pos: number, version: number, onFrame: (id: string, body: Uint8Array) => void) {
  const idLen = version === 2 ? 3 : 4;
  const headerLen = version === 2 ? 6 : 10;

  const frameSize = (at: number): number => {
    if (version === 2) return (data[at + 3] << 16) | (data[at + 4] << 8) | data[at + 5];
    if (version === 3) return uint32(data, at + 4);
    // v2.4 sizes are synchsafe, but some writers (old iTunes) wrote plain ints.
    const raw = data.subarray(at + 4, at + 8);
    if (raw.some((x) => x & 0x80)) return uint32(data, at + 4);
    const ss = synchsafe(data, at + 4);
    const plain = uint32(data, at + 4);
    if (ss !== plain) {
      const okAt = (n: number) => n === data.length || (n + 4 <= data.length && (data[n] === 0 || isFrameId(ascii(data, n, 4))));
      if (!okAt(at + 10 + ss) && okAt(at + 10 + plain)) return plain;
    }
    return ss;
  };

  while (pos + headerLen <= data.length) {
    const id = ascii(data, pos, idLen);
    if (!isFrameId(id)) break; // reached padding
    const fsize = frameSize(pos);
    const fflags = version === 2 ? 0 : (data[pos + 8] << 8) | data[pos + 9];
    pos += headerLen;
    if (fsize <= 0 || pos + fsize > data.length) break;
    let fd = data.subarray(pos, pos + fsize);
    pos += fsize;

    if (version === 3) {
      if (fflags & 0x00c0) continue; // compressed or encrypted
      if (fflags & 0x0020) fd = fd.subarray(1); // grouping id
    } else if (version === 4) {
      if (fflags & 0x000c) continue; // compressed or encrypted
      if (fflags & 0x0040) fd = fd.subarray(1); // grouping id
      if (fflags & 0x0001) fd = fd.subarray(4); // data length indicator
      if (fflags & 0x0002) fd = removeUnsync(fd);
    }
    if (fd.length > 0) onFrame(id, fd);
  }
}

/** CHAP frame (ID3v2 chapter addendum): element id, start/end ms, byte offsets, then sub-frames. */
function parseChapter(fd: Uint8Array, version: number): Id3Chapter | null {
  const idEnd = afterTerminator(fd, 0, 0);
  if (idEnd + 16 > fd.length) return null;
  const chapter: Id3Chapter = { start: uint32(fd, idEnd) / 1000 };
  iterateFrames(fd, idEnd + 16, version, (id, body) => {
    if ((id === 'TIT2' || id === 'TIT3') && !chapter.title) {
      const title = decodeText(body.subarray(1), body[0]);
      if (title) chapter.title = title;
    }
  });
  return chapter;
}

/**
 * Parse an ID3v2 tag from a buffer that begins with the "ID3" header and
 * contains the full tag. Returns {} if the buffer is not a supported tag.
 */
export function parseId3v2(buf: Uint8Array): Id3Tags {
  if (buf.length < 10 || ascii(buf, 0, 3) !== 'ID3') return {};
  const version = buf[3];
  if (version < 2 || version > 4) return {};
  const flags = buf[5];
  const size = synchsafe(buf, 6);
  let data = buf.subarray(10, Math.min(buf.length, 10 + size));

  // v2.2/v2.3 unsynchronise the whole tag; v2.4 does it per frame.
  if (flags & 0x80 && version < 4) data = removeUnsync(data);

  let pos = 0;
  if (flags & 0x40 && version >= 3) {
    // Extended header: v2.3 size excludes its own 4 bytes, v2.4 is synchsafe and includes them.
    pos = version === 3 ? 4 + uint32(data, 0) : synchsafe(data, 0);
  }

  const tags: Id3Tags = {};
  const pictures: Id3Picture[] = [];
  const chapters: Id3Chapter[] = [];

  iterateFrames(data, pos, version, (id, fd) => {
    const key = FRAME_KEYS[id];
    if (key) {
      if (!tags[key]) {
        const value = decodeText(fd.subarray(1), fd[0]);
        if (value) tags[key] = value;
      }
    } else if (id === 'APIC' || id === 'PIC') {
      const pic = parsePicture(fd, version);
      if (pic) pictures.push(pic);
    } else if (id === 'CHAP' && version >= 3) {
      const ch = parseChapter(fd, version);
      if (ch) chapters.push(ch);
    }
  });

  if (chapters.length) tags.chapters = chapters.sort((a, b) => a.start - b.start);
  // Prefer the front cover (type 3), else whatever came first.
  const picture = pictures.find((p) => p.type === 3) ?? pictures[0];
  if (picture) tags.picture = picture;
  return tags;
}

/** Parse a 128-byte ID3v1 tag (the last 128 bytes of the file). */
export function parseId3v1(b: Uint8Array): Id3Tags {
  if (b.length !== 128 || ascii(b, 0, 3) !== 'TAG') return {};
  const field = (o: number, n: number) => decodeText(b.subarray(o, o + n), 0);
  const tags: Id3Tags = {};
  const title = field(3, 30);
  const artist = field(33, 30);
  const album = field(63, 30);
  if (title) tags.title = title;
  if (artist) tags.artist = artist;
  if (album) tags.album = album;
  if (b[125] === 0 && b[126] !== 0) tags.track = String(b[126]); // ID3v1.1
  return tags;
}

/** Read tags from a file, touching only the bytes that hold them. */
export async function readTags(file: Blob): Promise<Id3Tags> {
  let tags: Id3Tags = {};
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length === 10 && ascii(head, 0, 3) === 'ID3') {
    const total = 10 + synchsafe(head, 6) + (head[5] & 0x10 ? 10 : 0);
    if (total <= MAX_TAG_BYTES) {
      tags = parseId3v2(new Uint8Array(await file.slice(0, total).arrayBuffer()));
    }
  }
  if (!tags.title && file.size >= 128) {
    const v1 = parseId3v1(new Uint8Array(await file.slice(file.size - 128).arrayBuffer()));
    tags = { ...v1, ...tags };
  }
  return tags;
}

/** "3/12" → 3 */
export function parseTrackNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
