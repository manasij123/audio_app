import { describe, expect, it } from 'vitest';
import { mergeSync, type RemoteData } from './sync';
import type { Bookmark, Progress } from './types';

const P = 'me';
const prog = (trackId: string, position: number, updatedAt: number, extra: Partial<Progress> = {}): Progress => ({
  profileId: P,
  trackId,
  position,
  favorite: false,
  finished: false,
  lastPlayedAt: null,
  updatedAt,
  ...extra,
});
const bm = (id: string, updatedAt: number, extra: Partial<Bookmark> = {}): Bookmark => ({
  id,
  profileId: P,
  trackId: 't1',
  time: 10,
  note: '',
  createdAt: 1,
  updatedAt,
  ...extra,
});
const strip = ({ profileId: _p, trackId: _t, ...r }: Progress) => r;

describe('mergeSync', () => {
  it('uploads everything when the cloud copy is empty', () => {
    const r = mergeSync(P, { progress: [prog('a', 5, 10)], bookmarks: [bm('b1', 10)] }, null, 100);
    expect(r.remoteChanged).toBe(true);
    expect(r.localProgress).toEqual([]);
    expect(r.remote.progress.a.position).toBe(5);
    expect(r.remote.bookmarks.b1.time).toBe(10);
  });

  it('newer side wins per track, both directions', () => {
    const remote: RemoteData = {
      version: 1,
      progress: { a: strip(prog('a', 100, 50)), b: strip(prog('b', 7, 5)) },
      bookmarks: {},
      updatedAt: 50,
    };
    const r = mergeSync(P, { progress: [prog('a', 20, 40), prog('b', 70, 60)], bookmarks: [] }, remote, 100);
    expect(r.localProgress).toEqual([prog('a', 100, 50)]); // remote newer for a
    expect(r.remote.progress.b.position).toBe(70); // local newer for b
    expect(r.remoteChanged).toBe(true);
  });

  it('reports no remote change when already in sync', () => {
    const remote: RemoteData = { version: 1, progress: { a: strip(prog('a', 5, 10)) }, bookmarks: {}, updatedAt: 10 };
    const r = mergeSync(P, { progress: [prog('a', 5, 10)], bookmarks: [] }, remote, 100);
    expect(r.remoteChanged).toBe(false);
    expect(r.localProgress).toEqual([]);
  });

  it('propagates bookmark deletions as tombstones and drops old ones', () => {
    const now = 200 * 24 * 3600 * 1000;
    const remote: RemoteData = {
      version: 1,
      progress: {},
      bookmarks: { b1: { trackId: 't1', time: 10, note: '', createdAt: 1, updatedAt: 10 }, old: { trackId: 't1', time: 1, note: '', createdAt: 1, updatedAt: 1, deleted: true } },
      updatedAt: 10,
    };
    const r = mergeSync(P, { progress: [], bookmarks: [bm('b1', now - 1000, { deleted: true })] }, remote, now);
    expect(r.remote.bookmarks.b1.deleted).toBe(true);
    expect(r.remote.bookmarks.old).toBeUndefined();
    expect(r.remoteChanged).toBe(true);
  });
});
