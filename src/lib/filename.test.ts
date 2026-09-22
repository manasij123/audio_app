import { describe, expect, it } from 'vitest';
import { isAudioFile, titleFromFileName, trackIdFor, trackNoFromFileName } from './filename';

describe('titleFromFileName', () => {
  it.each([
    ['#12# Sunday Suspense - Feluda [dQw4w9WgXcQ] (128k).mp3', 'Sunday Suspense - Feluda'],
    ['#3#Sonar Kella (128k) [abc_DEF-123].mp3', 'Sonar Kella'],
    ['Byomkesh (320 kbps).mp3', 'Byomkesh'],
    ['ঘনাদা_গল্প.mp3', 'ঘনাদা গল্প'],
    ['Plain title.mp3', 'Plain title'],
    ['Keep [Part 2].mp3', 'Keep [Part 2]'],
  ])('%s → %s', (input, expected) => {
    expect(titleFromFileName(input)).toBe(expected);
  });
});

describe('trackNoFromFileName', () => {
  it('reads the leading #N# marker only', () => {
    expect(trackNoFromFileName('#12# Title.mp3')).toBe(12);
    expect(trackNoFromFileName('1971 Title.mp3')).toBeNull();
  });
});

describe('trackIdFor', () => {
  it('uses the path relative to the picked folder', () => {
    expect(trackIdFor({ name: 'a.mp3', webkitRelativePath: 'Stories/Feluda/a.mp3' })).toBe('Feluda/a.mp3');
    expect(trackIdFor({ name: 'a.mp3', webkitRelativePath: 'Stories/a.mp3' })).toBe('a.mp3');
    expect(trackIdFor({ name: 'a.mp3', webkitRelativePath: '' })).toBe('a.mp3');
  });
});

describe('isAudioFile', () => {
  it('accepts audio MIME types or known extensions', () => {
    expect(isAudioFile({ name: 'x.mp3', type: '' })).toBe(true);
    expect(isAudioFile({ name: 'x', type: 'audio/mpeg' })).toBe(true);
    expect(isAudioFile({ name: 'cover.jpg', type: 'image/jpeg' })).toBe(false);
  });
});
