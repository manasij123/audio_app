/**
 * Story genres: five main genres, each with sub-genres. A track stores tag ids —
 * either "main" (e.g. "horror") or "main.sub" (e.g. "horror.tantrik").
 */

export interface SubGenre {
  id: string;
  name: string;
  en: string;
  about: string;
  examples?: string;
}

export interface Genre {
  id: GenreId;
  name: string;
  en: string;
  about: string;
  subs: SubGenre[];
}

export type GenreId = 'mystery' | 'thriller' | 'horror' | 'adventure' | 'scifi';

export const GENRES: Genre[] = [
  {
    id: 'mystery',
    name: 'গোয়েন্দা ও রহস্য',
    en: 'Detective / Mystery',
    about: 'অপরাধ আগেই ঘটে গেছে, গল্প পিছনের দিকে খুঁজে বের করে কে করল।',
    subs: [
      { id: 'classic', name: 'ক্লাসিক গোয়েন্দা', en: 'Whodunit', about: 'খুন বা চুরি, সূত্র ধরে ধাঁধার সমাধান', examples: 'ফেলুদা, ব্যোমকেশ, কিরীটী রায়' },
      { id: 'locked-room', name: 'বন্ধ ঘরের রহস্য', en: 'Locked room', about: 'অসম্ভব মনে হওয়া অপরাধ: দরজা বন্ধ, তবু খুন', examples: 'ব্যোমকেশ আর কিরীটীর কিছু গল্প' },
      { id: 'police', name: 'পুলিশি তদন্ত', en: 'Police procedural', about: 'পুলিশের দল ধাপে ধাপে কেস সমাধান করে', examples: 'শবর দাশগুপ্ত' },
      { id: 'cozy', name: 'শখের গোয়েন্দা', en: 'Cozy mystery', about: 'সাধারণ মানুষ গোয়েন্দা, ছোট পরিসর, হিংস্রতা কম', examples: 'মিতিন মাসি, অর্জুন' },
      { id: 'noir', name: 'হার্ডবয়েলড / নোয়া', en: 'Noir', about: 'রুক্ষ গোয়েন্দা, দুর্নীতিতে ভরা সমাজ, ভালো-খারাপের সীমা ঝাপসা' },
      { id: 'heist', name: 'চুরি-ডাকাতির ছক', en: 'Heist', about: 'অপরাধীরাই মূল চরিত্র, অসম্ভব চুরির পরিকল্পনা' },
    ],
  },
  {
    id: 'thriller',
    name: 'থ্রিলার',
    en: 'Thriller',
    about: 'বিপদ এখনও ঘটেনি, নায়ক সেটা আটকাতে ছুটছে।',
    subs: [
      { id: 'psychological', name: 'মনস্তাত্ত্বিক', en: 'Psychological', about: 'মনের জটিলতা, বিভ্রম, কাকে বিশ্বাস করা যায় সেই দ্বিধা' },
      { id: 'crime', name: 'ক্রাইম থ্রিলার', en: 'Crime', about: 'অপরাধ ঘটছে বা ঘটতে চলেছে, সেটা আটকানোর দৌড়' },
      { id: 'serial-killer', name: 'সিরিয়াল কিলার', en: 'Serial killer', about: 'ধারাবাহিক খুনি আর তাকে ধরার খেলা' },
      { id: 'domestic', name: 'ঘরোয়া', en: 'Domestic', about: 'সংসার আর দাম্পত্যের ভিতরে সন্দেহ, বিশ্বাসঘাতকতা' },
      { id: 'revenge', name: 'প্রতিশোধ', en: 'Revenge', about: 'অন্যায়ের বদলা নেওয়ার গল্প' },
      { id: 'survival', name: 'বেঁচে ফেরার লড়াই', en: 'Survival', about: 'জঙ্গল, দুর্ঘটনা, বন্দিদশা থেকে প্রাণ বাঁচানো' },
      { id: 'spy', name: 'গুপ্তচর', en: 'Spy', about: 'গুপ্তচর, ষড়যন্ত্র, দেশের উপর বিপদ' },
      { id: 'political', name: 'রাজনৈতিক', en: 'Political', about: 'ক্ষমতা, ষড়যন্ত্র, সরকারি চক্রান্ত' },
      { id: 'legal', name: 'আইন-আদালত', en: 'Legal', about: 'উকিল বা বিচারক, আদালতের নাটক' },
      { id: 'medical', name: 'চিকিৎসা', en: 'Medical', about: 'ডাক্তার, রহস্যময় রোগ, চিকিৎসার নৈতিকতা' },
      { id: 'techno', name: 'প্রযুক্তি', en: 'Techno-thriller', about: 'সাইবার-অপরাধ, উন্নত প্রযুক্তি' },
      { id: 'supernatural', name: 'অতিপ্রাকৃত থ্রিলার', en: 'Supernatural', about: 'থ্রিলারের গতি আর ভৌতিক বা অলৌকিক উপাদান একসাথে' },
    ],
  },
  {
    id: 'horror',
    name: 'ভৌতিক ও হরর',
    en: 'Horror',
    about: 'ভয়ংকর কিছু চোখের সামনে এখনই ঘটছে।',
    subs: [
      { id: 'ghost', name: 'ভূতের গল্প', en: 'Supernatural', about: 'ভূত, প্রেত, আত্মা, পিশাচ', examples: 'সানডে সাসপেন্সের বহু গল্প, “পিশাচিনী”' },
      { id: 'tantrik', name: 'তন্ত্র-মন্ত্র', en: 'Tantrik', about: 'তন্ত্রসাধনা, অশুভ শক্তির সাথে লড়াই', examples: 'তারানাথ তান্ত্রিক' },
      { id: 'folk', name: 'লোককথার ভয়', en: 'Folk horror', about: 'গ্রামবাংলা, কুসংস্কার, পুরনো আচার-রীতি', examples: 'শাকচুন্নি, ব্রহ্মদৈত্য, নিশির ডাক' },
      { id: 'gothic', name: 'গথিক', en: 'Gothic', about: 'পোড়ো জমিদারবাড়ি, রাজবাড়ি, অভিশাপ, ক্ষয়', examples: 'জমিদারবাড়ির ভূতের গল্প' },
      { id: 'psychological', name: 'মনস্তাত্ত্বিক ভয়', en: 'Psychological horror', about: 'ভূত নেই, ভয় মানুষের মনের ভিতরেই: পাগলামি, আতঙ্ক, নিষ্ঠুরতা' },
      { id: 'cosmic', name: 'মহাজাগতিক ভয়', en: 'Cosmic horror', about: 'অজানা, প্রাচীন, মানুষের বোধের বাইরের শক্তি' },
      { id: 'body', name: 'শরীরের ভয়', en: 'Body horror', about: 'শরীরের বিকৃতি, রূপান্তর' },
      { id: 'uncanny', name: 'অলৌকিক', en: 'Uncanny', about: 'ব্যাখ্যা করা যায় না এমন ঘটনা, ভয়ের চেয়ে রহস্য বেশি', examples: 'বরদার গল্প, তারিণীখুড়ো' },
    ],
  },
  {
    id: 'adventure',
    name: 'অ্যাডভেঞ্চার',
    en: 'Adventure',
    about: 'অজানার পথে বেরিয়ে পড়া: অভিযান, গুপ্তধন, বিপদ।',
    subs: [
      { id: 'expedition', name: 'অভিযান ও গুপ্তধন', en: 'Expedition', about: 'অজানা জায়গা, হারানো জিনিসের খোঁজ, শত্রুর পিছু নেওয়া', examples: 'কাকাবাবু' },
      { id: 'tall-tale', name: 'আষাঢ়ে গল্প', en: 'Tall tale', about: 'অবিশ্বাস্য অভিযানের মজার বর্ণনা', examples: 'ঘনাদা, টেনিদা' },
      { id: 'jungle', name: 'বন-জঙ্গল ও শিকার', en: 'Jungle', about: 'জঙ্গল, পশু, প্রকৃতির বিপদ' },
      { id: 'historical', name: 'ঐতিহাসিক', en: 'Historical', about: 'পুরনো যুগের পটভূমিতে রহস্য বা অভিযান', examples: 'শরদিন্দুর ঐতিহাসিক গল্প' },
    ],
  },
  {
    id: 'scifi',
    name: 'কল্পবিজ্ঞান ও ফ্যান্টাসি',
    en: 'Sci-fi / Fantasy',
    about: 'বিজ্ঞান আর কল্পনার সীমা পেরিয়ে যাওয়া গল্প।',
    subs: [
      { id: 'scifi', name: 'কল্পবিজ্ঞান', en: 'Science fiction', about: 'বিজ্ঞানী, আবিষ্কার, ভিনগ্রহ', examples: 'প্রফেসর শঙ্কু' },
      { id: 'fantasy', name: 'ফ্যান্টাসি', en: 'Fantasy', about: 'জাদু, অবাস্তব জগৎ' },
    ],
  },
];

/** The four words people mix up, shown as a key on the genres screen. */
export const GENRE_TERMS: { name: string; en: string; about: string }[] = [
  { name: 'রহস্য', en: 'Mystery', about: 'অপরাধ আগেই ঘটে গেছে, গল্প পিছনের দিকে খুঁজে বের করে কে করল।' },
  { name: 'থ্রিলার', en: 'Thriller', about: 'বিপদ এখনও ঘটেনি, নায়ক সেটা আটকাতে ছুটছে।' },
  { name: 'সাসপেন্স', en: 'Suspense', about: 'শ্রোতা এমন কিছু জানে যা চরিত্র জানে না, সেই টেনশন।' },
  { name: 'হরর', en: 'Horror', about: 'ভয়ংকর কিছু চোখের সামনে এখনই ঘটছে।' },
];

export const GENRE_BY_ID = new Map(GENRES.map((g) => [g.id, g]));

export function mainOf(tag: string): GenreId {
  return tag.split('.')[0] as GenreId;
}

/** Does a track's tag list include this genre ("horror") or sub-genre ("horror.tantrik")? */
export function hasTag(tags: readonly string[], filter: string): boolean {
  return filter.includes('.') ? tags.includes(filter) : tags.some((t) => mainOf(t) === filter);
}

/** Human label for a tag: the sub-genre name, or the main genre name. */
export function tagLabel(tag: string): string {
  const [main, sub] = tag.split('.');
  const g = GENRE_BY_ID.get(main as GenreId);
  if (!g) return tag;
  return sub ? (g.subs.find((s) => s.id === sub)?.name ?? g.name) : g.name;
}

export function isValidTag(tag: string): boolean {
  const [main, sub] = tag.split('.');
  const g = GENRE_BY_ID.get(main as GenreId);
  return !!g && (sub == null || g.subs.some((s) => s.id === sub));
}

/** Keywords (Bengali and romanised) that identify a sub-genre from a title, album or folder name. */
const RULES: [tag: string, pattern: RegExp][] = [
  ['mystery.police', /শবর|shabor|shabar|লালবাজার|lalbazar/i],
  ['mystery.cozy', /মিতিন|mitin|অর্জুন|\barjun\b/i],
  ['mystery.locked-room', /locked.?room|বন্ধ ঘর/i],
  ['mystery.classic', /ফেলুদা|feluda|ব্যোমকেশ|byomkesh|bomkesh|কিরীটী|কিরিটি|kiriti|শার্লক|sherlock|holmes|পোয়ারো|poirot|গোয়েন্দা|গোয়েন্দা|goyenda|detective/i],
  ['horror.tantrik', /তারানাথ|taranath|তান্ত্রিক|tantrik|tantric|তন্ত্র|tantra/i],
  ['horror.folk', /শাকচুন্নি|শাঁকচুন্নি|ব্রহ্মদৈত্য|নিশির ডাক|nishir dak|ডাইনি|daini|\bwitch/i],
  ['horror.gothic', /জমিদার|zamindar|jamidar|রাজবাড়ি|rajbari|haveli/i],
  ['horror.uncanny', /তারিণী|tarini|বরদা|baroda|অলৌকিক|aloukik|alaukik|oloukik/i],
  ['horror.ghost', /ভূত|ভুত|bhoot|bhut|ghost|প্রেত|pret|পিশাচ|pishach|আত্মা|ভৌতিক|bhoutik|bhoutik|horror|হরর/i],
  ['adventure.tall-tale', /ঘনাদা|ghanada|টেনিদা|tenida/i],
  ['adventure.expedition', /কাকাবাবু|kakababu|গুপ্তধন|treasure|অভিযান|adventure|অ্যাডভেঞ্চার/i],
  ['adventure.jungle', /শিকার|shikar|জঙ্গল|jungle|corbett|করবেট/i],
  ['scifi.scifi', /শঙ্কু|shonku|shanku|কল্পবিজ্ঞান|sci.?fi|science fiction/i],
  ['scifi.fantasy', /fantasy|ফ্যান্টাসি|রূপকথা|rupkotha/i],
  ['thriller.serial-killer', /serial.?killer|সিরিয়াল কিলার/i],
  ['thriller.spy', /\bspy\b|গুপ্তচর|espionage/i],
  ['thriller.psychological', /psychological|মনস্তাত্ত্বিক/i],
  ['thriller.crime', /থ্রিলার|thriller|\bcrime\b/i],
];

/** Guess genre tags from whatever text we know about a track. */
export function detectGenres(...texts: (string | null | undefined)[]): string[] {
  const hay = texts.filter(Boolean).join(' \u0000 ');
  const found: string[] = [];
  for (const [tag, re] of RULES) if (re.test(hay) && !found.includes(tag)) found.push(tag);
  return found;
}
