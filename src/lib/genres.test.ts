import { describe, expect, it } from 'vitest';
import { detectGenres, GENRES, hasTag, isValidTag, tagLabel } from './genres';

describe('genres', () => {
  it('has five main genres, all rule tags valid', () => {
    expect(GENRES.map((g) => g.id)).toEqual(['mystery', 'thriller', 'horror', 'adventure', 'scifi']);
    expect(detectGenres('ফেলুদা তারানাথ শবর মিতিন কাকাবাবু ঘনাদা শঙ্কু ভূত জমিদার থ্রিলার').every(isValidTag)).toBe(true);
  });

  it.each([
    ['Sunday Suspense - Feluda - Sonar Kella', ['mystery.classic']],
    ['ব্যোমকেশ - সীমান্ত হীরা', ['mystery.classic']],
    ['তারানাথ তান্ত্রিক - মধুসুন্দরী দেবীর আবির্ভাব', ['horror.tantrik']],
    ['Kakababu - Sabuj Dwiper Raja', ['adventure.expedition']],
    ['প্রোফেসর শঙ্কু ও ইজিপ্সীয় আতঙ্ক', ['scifi.scifi']],
    ['জমিদারবাড়ির ভূত', ['horror.gothic', 'horror.ghost']],
    ['Mitin Masi', ['mystery.cozy']],
    ['Just a title', []],
  ])('%s', (title, expected) => {
    expect(detectGenres(title)).toEqual(expected);
  });

  it('uses the folder path too', () => {
    expect(detectGenres('Episode 12', null, 'Horror/Episode 12.mp3')).toEqual(['horror.ghost']);
  });

  it('matches main genres and sub-genres', () => {
    expect(hasTag(['horror.tantrik'], 'horror')).toBe(true);
    expect(hasTag(['horror.tantrik'], 'horror.tantrik')).toBe(true);
    expect(hasTag(['horror.tantrik'], 'horror.ghost')).toBe(false);
    expect(hasTag(['horror'], 'horror')).toBe(true);
    expect(tagLabel('horror.tantrik')).toBe('তন্ত্র-মন্ত্র');
    expect(tagLabel('mystery')).toBe('গোয়েন্দা ও রহস্য');
  });
});
