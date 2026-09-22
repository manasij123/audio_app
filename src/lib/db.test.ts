import { describe, expect, it } from 'vitest';
import { memoryLibraryStore, progressOf } from './db';
import type { Profile, Track } from './types';
import { normalizeTrack } from './types';

const profile = (id: string): Profile => ({ id, name: id, hue: 1, pinHash: null, pinSalt: null, createdAt: 1, google: null });
const track = (id: string): Track => normalizeTrack({ id, title: id, sizeBytes: 10, addedAt: 1 });

describe('LibraryStore (memory backend)', () => {
  it('keeps listening state separate per profile while sharing tracks', async () => {
    const s = memoryLibraryStore();
    await s.putProfile(profile('a'));
    await s.putProfile(profile('b'));
    await s.add(track('t1'), new Blob(['x']), null);
    await s.saveProgress(progressOf('a', { ...track('t1'), position: 42, favorite: true }));

    const a = await s.load('a');
    const b = await s.load('b');
    expect(a.tracks[0]).toMatchObject({ id: 't1', position: 42, favorite: true });
    expect(b.tracks[0]).toMatchObject({ id: 't1', position: 0, favorite: false });
  });

  it('deleting a track removes its audio, progress and bookmarks for everyone', async () => {
    const s = memoryLibraryStore();
    await s.add(track('t1'), new Blob(['x']), new Blob(['c']));
    await s.saveProgress(progressOf('a', { ...track('t1'), position: 5 }));
    await s.putBookmarks([{ id: 'b', profileId: 'a', trackId: 't1', time: 1, note: '', createdAt: 1, updatedAt: 1 }]);
    await s.remove('t1');
    expect(await s.getAudio('t1')).toBeNull();
    expect(await s.getProgress('a')).toEqual([]);
    expect(await s.getBookmarks('a')).toEqual([]);
    expect((await s.load('a')).covers.size).toBe(0);
  });

  it('deleting a profile removes only its data', async () => {
    const s = memoryLibraryStore();
    await s.putProfile(profile('a'));
    await s.putProfile(profile('b'));
    await s.saveProgress(progressOf('a', { ...track('t1'), position: 5 }));
    await s.saveProgress(progressOf('b', { ...track('t1'), position: 9 }));
    await s.deleteProfile('a');
    expect((await s.listProfiles()).map((p) => p.id)).toEqual(['b']);
    expect(await s.getProgress('a')).toEqual([]);
    expect((await s.getProgress('b'))[0].position).toBe(9);
  });

  it('the first profile adopts progress saved by the old single-user version', async () => {
    const s = memoryLibraryStore();
    // A v1 record carried position/favorite on the track itself.
    await s.add({ ...track('old'), position: 0 }, new Blob(['x']), null);
    const backend = (s as unknown as { db: { write(ops: object[]): Promise<void> } }).db;
    await backend.write([{ store: 'tracks', put: { ...track('old'), position: 33, favorite: true } }]);
    await s.putProfile(profile('first'));
    const loaded = await s.load('first');
    expect(loaded.tracks[0]).toMatchObject({ position: 33, favorite: true });
  });
});
