# শ্রুতি · Shruti

*Shruti* (শ্রুতি, "that which is heard") is a personal, offline library and player for audio
stories such as Sunday Suspense and Feluda radio dramas. It is a React single-page app that runs
entirely in the browser: there is no backend, and your files are never uploaded anywhere.

## Features

- **Import a folder** (or pick files). Each file's ID3 tags are read in the browser: ID3v2.2,
  v2.3 and v2.4 (including v2.4's synchsafe frame sizes and iTunes-style plain sizes),
  all four text encodings, and embedded cover art (APIC/PIC). ID3v1 is used as a fallback.
- If a file has no title tag, the title comes from its file name. A leading `#N#` marker,
  a trailing `[videoId]` and `(128k)`-style suffixes are removed.
- **The library persists in IndexedDB.** Audio is stored as raw blobs (no base64). The folder is
  picked once; after that the library loads straight from the device. Re-importing a folder only
  adds new files and reports "X new, Y already existed".
- The **library view** is sorted by track number, then by title. Each row shows the cover,
  title, number, duration (found in the background), resume progress, a favorite star, and
  delete with a two-tap confirmation. You can search titles and filter to All or Favorites. The
  header shows the episode count and the total size stored on the device.
- **Player:**
  - Previous and next move through the list as currently filtered and sorted.
  - ±15-second skip, a seek bar, and a speed button that cycles 1×, 1.25×, 1.5×, 1.75×, 2×,
    0.75× (the chosen speed is remembered).
  - The playback position is saved per track every 5 seconds and on pause or when you leave
    the page. Playback resumes from that position unless it is within the last 10 seconds.
  - When a track finishes, its position resets and the next track starts.
  - Lock-screen and notification controls use the Media Session API.
  - On desktop: Space plays or pauses; ← and → skip 15 seconds.
- **Offline:** a small service worker caches the app itself. Playback always uses local blobs.
- Light and dark themes follow the system setting. The layout is designed first for Android
  Chrome at phone width.

## Storage design

Every track has an `id`: its path relative to the imported folder, or its file name for loose
files. Track data is split across three IndexedDB object stores that all use this id:

| store    | contents                                                                                     |
| -------- | -------------------------------------------------------------------------------------------- |
| `tracks` | metadata: title, album, artist, trackNo, sizeBytes, favorite, position, duration, addedAt, … |
| `covers` | `{ id, blob }`: the embedded cover image                                                     |
| `audio`  | `{ id, blob }`: the audio file itself                                                        |

Position updates arrive every few seconds during playback. With this split, each update rewrites
only a small metadata record, not a record that also holds a 200 MB blob.

- Every storage call is wrapped in error handling.
- If IndexedDB is unavailable (for example in some private-browsing modes), the app falls back
  to in-memory storage and shows a warning banner.
- If the device runs out of space during an import, the import stops and the app says so.
- After an import, the app calls `navigator.storage.persist()`.

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (ID3 parser, filename handling)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build (service worker active)
```

The `dist/` folder is static. Host it on any HTTPS server (GitHub Pages, Netlify, …) so the
service worker and installation work, then open it in Chrome on Android and choose
**Add to Home screen**.

**Picking a folder on Android:** support for folder selection varies by Chrome version. If you
can't select a folder, use **Add files** and select every file inside it; dedupe still works
because loose files are keyed by file name.
