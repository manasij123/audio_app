# শ্রুতি · Shruti

*Shruti* (শ্রুতি, "that which is heard") is a personal, offline library and player for audio
stories such as Sunday Suspense and Feluda radio dramas. It is a React single-page app that runs
entirely in the browser. Your audio files never leave the device.

## Features

**Library**
- **Import a folder or pick files.** Tags are read in the browser: ID3v2.2, v2.3 and v2.4
  (including v2.4's synchsafe frame sizes and iTunes-style plain sizes), all four text
  encodings, cover art (APIC/PIC) and chapter markers (CHAP). ID3v1 is used as a fallback.
- If a file has no title tag, the title comes from its file name. A leading `#N#` marker,
  a trailing `[videoId]` and `(128k)`-style suffixes are removed.
- Audio is stored in IndexedDB as raw blobs (no base64). Re-importing a folder only adds new
  files and reports "X new, Y already existed".
- Search titles; filter by All, Favourites, In progress, New or Finished (with counts); sort by
  episode number, title, recently added, recently played or length.
- Each episode has a status pill (নতুন / time left / ✓ finished), a progress bar and a star.
  The ⋯ menu offers play next, add to queue, mark as played or unplayed, bookmarks, rename,
  file info, and delete with a two-tap confirmation.
- Tracks without cover art get a generated tile: a colour derived from the title and its
  first Bengali letter.

**Player**
- A mini-player sits above the tab bar. Tapping it opens a full-screen player tinted with the
  cover's colour.
- Seek bar with chapter and bookmark marks, and elapsed / remaining time (adjusted for speed).
- Speed from 0.5× to 3× in 0.05× steps, plus presets.
- Skip back and forward, configurable (back 5–30 s, forward 10–60 s).
- **Sleep timer:** 5–90 minutes or "end of episode". It counts down only while playing, fades
  out over the last 10 seconds, and shaking the phone adds 5 minutes.
- **Bookmarks:** one tap saves the current moment; notes are optional. The Bookmarks tab lists
  them all, and tapping one plays from that exact point.
- **Chapters** from ID3 CHAP frames.
- **Queue ("Up next")** with reordering. When the queue is empty, playback continues in library
  order.
- **Sound:**
  - volume boost (1.5×/2×/3×, with a limiter so it doesn't distort)
  - skip silence (speeds through quiet gaps and counts the time saved)
  - voice clarity (reduces rumble and lifts speech frequencies)
- **Resume:**
  - the position is saved every 5 seconds and on pause or close
  - playback resumes there unless the saved position is within the last 10 seconds
  - auto-rewind steps back a little after long pauses
  - the next episode can start automatically
- Lock-screen and notification controls use the Media Session API. On desktop, Space plays or
  pauses and ←/→ skip.

**Branding:** the Shruti logo (`public/logo.webp`) appears on the home screen; the login screen shows  (the logo with the five couplets of the Shruti rhyme in illustrated clouds, beside the profile card on wide screens) and is used for the app icons; the palette (warm black, blood red, bone white) and the Galada display face follow the logo.

**Genres (ধরন tab)**
- Five main genres with sub-genres: গোয়েন্দা ও রহস্য (6), থ্রিলার (12), ভৌতিক ও হরর (8),
  অ্যাডভেঞ্চার (4), কল্পবিজ্ঞান ও ফ্যান্টাসি (2). The taxonomy lives in `src/lib/genres.ts`.
- Tap a genre card or any sub-genre chip to see its stories; previous/next then follow that list.
- A story can have several genres. They are set three ways:
  - **At import:** choose "detect automatically" or give the whole batch the same genres.
  - **Detected from names:** title, album and folder path are matched against keywords
    (ফেলুদা/Feluda, ব্যোমকেশ, তারানাথ, কাকাবাবু, ঘনাদা, শঙ্কু, ভূত, জমিদার…). Stories imported
    before genres existed are classified this way once.
  - **By hand:** ⋯ menu → ধরন.
- A key explains how রহস্য, থ্রিলার, সাসপেন্স and হরর differ.

**Home**
- A "Continue listening" carousel.
- Listening stats: today, this week (7-day chart), daily streak, finished episodes and all-time
  total.
- Recently added episodes.

**Profiles & login**
- "কে শুনছেন?" (who's listening?) profile picker. Each profile has its own progress,
  favourites, bookmarks, stats, queue and settings. The audio library is shared between
  profiles.
- Optional 4-digit **PIN** per profile, hashed with PBKDF2-SHA-256 via WebCrypto. Five wrong
  tries lock the pad for 30 seconds. The PIN keeps others on a shared phone out of your
  profile; it does **not** encrypt the files.
- Optional **Google sign-in** (Firebase) to sync progress, favourites, finished flags and
  bookmarks across devices. Audio files are never uploaded. Sync is local-first: everything
  works offline and catches up when online. Conflicts are resolved per episode and per
  bookmark, and the most recent change wins. Episodes are matched by their path inside the
  imported folder, so import the same folder on each device. If you forget the PIN on a
  Google-linked profile, you can remove it by signing in with that Google account.

**Settings & data**
- Theme: system, light or dark.
- Storage usage and quota, and a button to protect storage from being cleared
  (`navigator.storage.persist()`).
- "Delete finished episodes" (two-tap) to free space.
- **Backup:** export or import a profile's progress and bookmarks as a JSON file, merged the
  same way as cloud sync.
- If IndexedDB isn't available (for example in some private-browsing modes), the app keeps the
  library in memory for the session and shows a warning. Every storage call is wrapped in
  error handling.
- No `alert()` / `confirm()` / `prompt()` pop-ups; every confirmation is built into the page.
- A service worker caches the app shell and the bundled Anek Bangla font, so the app opens
  with no network.

## Storage design

IndexedDB database `shruti` (version 2):

| store       | key                     | contents                                                                                  |
| ----------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `tracks`    | `id`                    | shared metadata: title, album, artist, trackNo, sizeBytes, duration, addedAt, chapters, … |
| `covers`    | `id`                    | `{ id, blob }`: the embedded cover image                                                  |
| `audio`     | `id`                    | `{ id, blob }`: the audio file itself                                                     |
| `progress`  | `[profileId, trackId]`  | position, favourite, finished, lastPlayedAt, updatedAt                                    |
| `bookmarks` | `id`                    | profileId, trackId, time, note (deletions are kept as tombstones so sync can see them)   |
| `stats`     | `[profileId, day]`      | seconds listened and seconds saved by skip-silence                                        |
| `profiles`  | `id`                    | name, avatar hue, PIN hash and salt, linked Google account                                |

A track's `id` is its path relative to the imported folder, or its file name for loose files.
Position saves happen every few seconds, and each one writes only a small `progress` record,
never a record holding a 200 MB blob. Data from version 1 of the app is picked up by the
first profile you create.

## Setting up Google sign-in (optional)

Without this, Shruti works fully offline with local profiles, and the Google button is hidden.

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Get started → Sign-in method → Google → Enable.**
3. **Authentication → Settings → Authorized domains:** add the domain you host Shruti on
   (for example `yourname.github.io`).
4. **Firestore Database → Create database** (production mode), then set these **Rules**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **Project settings → Your apps → Add web app**, then copy the `firebaseConfig`. Either:
   - put it in a `.env` file before building:
     ```
     VITE_FIREBASE_API_KEY=...
     VITE_FIREBASE_AUTH_DOMAIN=...
     VITE_FIREBASE_PROJECT_ID=...
     VITE_FIREBASE_APP_ID=...
     ```
   - or paste it in the app under **Settings → Google অ্যাকাউন্ট ও Sync → Add Firebase config**.

Each Google account's data lives in a single Firestore document, `users/{uid}`, which only
that account can read or write.

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (ID3 + chapters, filename handling, storage, sync merge)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build (service worker active)
```

The `dist/` folder is static. Host it on any HTTPS server (GitHub Pages, Netlify, …) so the
service worker, Google sign-in and installation work, then open it in Chrome on Android and
choose **Add to Home screen**.

**Picking a folder on Android:** support for folder selection varies by Chrome version. If you
can't select a folder, use **ফাইল যোগ** and select every file inside it; dedupe still works
because loose files are keyed by file name.
