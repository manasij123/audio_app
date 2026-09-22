import { describe, expect, it } from 'vitest';
import { decodeText, parseId3v1, parseId3v2, parseTrackNumber, readTags } from './id3';

const enc = new TextEncoder();
const cat = (...parts: ArrayLike<number>[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const ss = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const utf16le = (s: string) => {
  const b: number[] = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    b.push(c & 0xff, c >> 8);
  }
  return b;
};
const utf16be = (s: string) => {
  const b: number[] = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    b.push(c >> 8, c & 0xff);
  }
  return b;
};

function frame(version: 3 | 4, id: string, body: ArrayLike<number>, opts: { plainSizeInV4?: boolean; flags?: number } = {}) {
  const size = version === 4 && !opts.plainSizeInV4 ? ss(body.length) : be32(body.length);
  const flags = opts.flags ?? 0;
  return cat(ascii(id), size, [flags >> 8, flags & 0xff], body);
}

function tag(version: 2 | 3 | 4, frames: Uint8Array[], flags = 0, padding = 16) {
  const body = cat(...frames, new Uint8Array(padding));
  return cat(ascii('ID3'), [version, 0, flags], ss(body.length), body);
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8];

describe('decodeText', () => {
  it('handles all four encodings', () => {
    expect(decodeText(new Uint8Array([0x43, 0x61, 0x66, 0xe9]), 0)).toBe('Café');
    expect(decodeText(new Uint8Array([0xff, 0xfe, ...utf16le('ফেলুদা')]), 1)).toBe('ফেলুদা');
    expect(decodeText(new Uint8Array([0xfe, 0xff, ...utf16be('ফেলুদা')]), 1)).toBe('ফেলুদা');
    expect(decodeText(new Uint8Array(utf16be('সানডে')), 2)).toBe('সানডে');
    expect(decodeText(enc.encode('সানডে সাসপেন্স\0'), 3)).toBe('সানডে সাসপেন্স');
  });

  it('keeps the first of multiple null-separated values', () => {
    expect(decodeText(enc.encode('One\0Two'), 3)).toBe('One');
  });
});

describe('parseId3v2', () => {
  it('reads an ID3v2.3 tag (plain frame sizes, UTF-16 with BOM) and APIC', () => {
    const apic = cat([0], ascii('image/jpeg'), [0], [3], ascii('cover'), [0], JPEG);
    const buf = tag(3, [
      frame(3, 'TIT2', [1, 0xff, 0xfe, ...utf16le('ফেলুদা'), 0, 0]),
      frame(3, 'TALB', [0, ...ascii('Sunday Suspense')]),
      frame(3, 'TPE1', [0, ...ascii('Radio Mirchi')]),
      frame(3, 'TRCK', [0, ...ascii('7/52')]),
      frame(3, 'APIC', apic),
    ]);
    const tags = parseId3v2(buf);
    expect(tags.title).toBe('ফেলুদা');
    expect(tags.album).toBe('Sunday Suspense');
    expect(tags.artist).toBe('Radio Mirchi');
    expect(parseTrackNumber(tags.track)).toBe(7);
    expect(tags.picture?.mime).toBe('image/jpeg');
    expect(tags.picture?.type).toBe(3);
    expect(Array.from(tags.picture!.data)).toEqual(JPEG);
  });

  it('reads an ID3v2.4 tag with synchsafe frame sizes (> 127 bytes) and UTF-8', () => {
    const longTitle = 'ক'.repeat(100); // 300 UTF-8 bytes → synchsafe differs from plain int
    const tags = parseId3v2(tag(4, [frame(4, 'TIT2', [3, ...enc.encode(longTitle)]), frame(4, 'TPE2', [3, ...enc.encode('Mirchi')])]));
    expect(tags.title).toBe(longTitle);
    expect(tags.albumArtist).toBe('Mirchi');
  });

  it('tolerates v2.4 tags written with plain (non-synchsafe) sizes', () => {
    const longTitle = 'x'.repeat(200);
    const tags = parseId3v2(
      tag(4, [frame(4, 'TIT2', [0, ...ascii(longTitle)], { plainSizeInV4: true }), frame(4, 'TALB', [0, ...ascii('Album')], { plainSizeInV4: true })]),
    );
    expect(tags.title).toBe(longTitle);
    expect(tags.album).toBe('Album');
  });

  it('handles UTF-16BE (encoding 2) and v2.4 data-length-indicator frames', () => {
    const body = [2, ...utf16be('গল্প')];
    const tags = parseId3v2(tag(4, [frame(4, 'TIT2', cat(ss(body.length), body), { flags: 0x0001 })]));
    expect(tags.title).toBe('গল্প');
  });

  it('undoes whole-tag unsynchronisation in v2.3 and finds the front cover among pictures', () => {
    const other = cat([0], ascii('image/png'), [0], [4], [0], [0x89, 0x50, 0x4e, 0x47, 9, 9, 9, 9]);
    const front = cat([1], ascii('image/jpg'), [0], [3], [0xff, 0xfe, ...utf16le('d'), 0, 0], JPEG);
    const raw = tag(3, [frame(3, 'APIC', other), frame(3, 'APIC', front), frame(3, 'TIT2', [0, ...ascii('Hi')])]);
    // Apply unsynchronisation to the tag body: insert 0x00 after every 0xFF.
    const body: number[] = [];
    for (const b of raw.subarray(10)) {
      body.push(b);
      if (b === 0xff) body.push(0);
    }
    const unsynced = cat(ascii('ID3'), [3, 0, 0x80], ss(body.length), body);
    const tags = parseId3v2(unsynced);
    expect(tags.title).toBe('Hi');
    expect(tags.picture?.type).toBe(3);
    expect(tags.picture?.mime).toBe('image/jpeg');
    expect(Array.from(tags.picture!.data)).toEqual(JPEG);
  });

  it('reads ID3v2.2 (3-char frame ids)', () => {
    const f = (id: string, body: number[]) => cat(ascii(id), [0, 0, body.length], body);
    const tags = parseId3v2(tag(2, [f('TT2', [0, ...ascii('Old tag')]), f('TRK', [0, ...ascii('3')]), f('PIC', [0, ...ascii('JPG'), 3, 0, ...JPEG])]));
    expect(tags.title).toBe('Old tag');
    expect(tags.track).toBe('3');
    expect(tags.picture?.mime).toBe('image/jpeg');
  });

  it('skips a v2.3 extended header', () => {
    const frames = frame(3, 'TIT2', [0, ...ascii('Ext')]);
    const ext = [...be32(6), 0, 0, 0, 0, 0, 0];
    const body = cat(ext, frames, new Uint8Array(8));
    expect(parseId3v2(cat(ascii('ID3'), [3, 0, 0x40], ss(body.length), body)).title).toBe('Ext');
  });

  it('returns {} for non-ID3 data', () => {
    expect(parseId3v2(new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0, 0, 0]))).toEqual({});
  });
});

describe('parseId3v1 / readTags', () => {
  const v1 = () => {
    const b = new Uint8Array(128);
    b.set(ascii('TAG'), 0);
    b.set(ascii('V1 Title'), 3);
    b.set(ascii('V1 Artist'), 33);
    b[126] = 9;
    return b;
  };

  it('parses ID3v1.1', () => {
    expect(parseId3v1(v1())).toEqual({ title: 'V1 Title', artist: 'V1 Artist', track: '9' });
  });

  it('reads only the tag from a Blob and falls back to ID3v1', async () => {
    const withV2 = new Blob([tag(3, [frame(3, 'TIT2', [0, ...ascii('From v2')])]), new Uint8Array(500)]);
    expect((await readTags(withV2)).title).toBe('From v2');
    const onlyV1 = new Blob([new Uint8Array(1000), v1()]);
    expect((await readTags(onlyV1)).title).toBe('V1 Title');
  });
});
