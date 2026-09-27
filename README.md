# শ্রুতি · Shruti

*Shruti* (শ্রুতি, "that which is heard") is an online audio-story app for Bengali thriller,
detective and horror stories. Listeners sign in and stream anything from the catalogue. The
owner and any admins they appoint upload and manage the stories. It is a React single-page app
backed by **Firebase**: Auth for login, Firestore for the catalogue and listener data, and
Storage for the audio and cover files.

## Roles

| Role | Who | Can do |
| --- | --- | --- |
| **Owner** | The first person to press **Settings → Claim ownership** after the app goes live (only possible once) | Everything an admin can do. Can never be removed. |
| **Admin** | The owner, plus anyone an admin adds by email | Upload, edit, publish or hide, and delete stories. See listener counts and recent listeners. Add or remove admins. |
| **Listener** | Anyone who signs up (Google or email + password) | Stream published stories. Favourites, progress, bookmarks and stats follow them to any device. |

These roles are enforced on the server by `firestore.rules` and `storage.rules`, not only in the
app.

## Features

**For listeners**
- **Login is required** (free): Google or email + password, with password reset.
- **Streaming:** stories play straight from Firebase Storage. Only signed-in users can get a
  stream URL.
- **Library, genres, search:**
  - search, status filters (All / Favourites / In progress / New / Finished) and five sort orders
  - genre filters: five main genres with 32 sub-genres (`src/lib/genres.ts`)
- **Player:** a skeuomorphic hardware deck:
  - spinning record with a tonearm
  - glowing display
  - metal transport keys
  - volume knob up to 300%
  - 6-band graphic EQ with presets
  - speed 0.5–3×
  - sleep timer (fade-out, shake to extend)
  - bookmarks, chapters, Up-next queue
  - skip silence, voice clarity, auto-rewind
  - lock-screen controls
- **Sync:** progress, favourites, finished flags and bookmarks are kept on the device and
  synced to `listening/{uid}`. The most recent change wins, per story and per bookmark.
- **Home:** Continue listening, a genre shelf, listening stats (7-day chart, streak) and
  recently added stories.

**For admins (অ্যাডমিন tab)**
- **Upload:** pick a folder or files. For each file the app reads, in the browser:
  - title, album, artist and track number (ID3v2.2/2.3/2.4 or ID3v1; otherwise from the
    file name)
  - cover art and chapters
  - duration
  - genre, from keywords such as ফেলুদা, ব্যোমকেশ, তারানাথ, কাকাবাবু or ভূত

  You review the list, rename where needed, choose automatic or fixed genres and "publish
  now" or "save as draft", then upload. Each file uploads resumably with its own progress
  bar, and you can stop part-way. Files already on the server are skipped.
- **Stories:** search, publish/draft toggles, and the ⋯ menu for rename, genres, hide and
  delete for everyone (two taps).
- **Listeners:** total count and the 50 most recently active.
- **Admins:** add by email (the person must have signed in once) or remove. The owner can't be
  removed.
- **Overview:** story count, published count, storage used and listener count.

**Look:** glassmorphic main frame, skeuomorphic player, the Shruti logo and login artwork, and a
faint line-art watermark over the screens. Warm black / blood red / bone white, with Anek Bangla
and Galada type.

## Data model

| Where | What |
| --- | --- |
| Firestore `tracks/{id}` | title, album, artist, trackNo, duration, sizeBytes, genres, chapters, fileName, sourcePath, audioPath, coverPath, coverUrl, **published**, createdAt, updatedAt |
| Firestore `users/{uid}` | name, email, photoURL, createdAt, lastSeen (listeners write their own; admins can read) |
| Firestore `listening/{uid}` | that listener's synced progress and bookmarks (only they can read or write it) |
| Firestore `admins/{uid}` | admin list |
| Firestore `config/owner` | who owns the installation (created once, never changed) |
| Storage `audio/{trackId}/{file}` | the audio (admins write, signed-in users read; audio types only, max 1 GB) |
| Storage `covers/{trackId}.{ext}` | cover images (admins write; images only, max 10 MB) |
| IndexedDB on the device | a local copy of the listener's progress, bookmarks and stats, so nothing is lost offline |

## Setting up your server (Firebase)

1. **Create a project** at <https://console.firebase.google.com>. Switch it to the
   **Blaze (pay-as-you-go)** plan: Cloud Storage for new projects requires it. Blaze
   includes a free allowance (5 GB stored, plus a monthly download allowance). Beyond that
   you pay per GB stored and per GB streamed, so set a **budget alert** under Google Cloud →
   Billing.
2. **Authentication → Get started → Sign-in method:** enable **Email/Password** and **Google**.
3. **Firestore Database → Create database** (production mode, a region near your listeners,
   e.g. `asia-south1`).
4. **Storage → Get started** (same region).
5. **Project settings → Your apps → Add app → Web.** Copy the config values into `.env.local`
   (see `.env.example`):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_APP_ID=...
   ```
6. **Deploy** the app, security rules and storage rules:
   ```bash
   npm install
   npx firebase login
   npx firebase use --add        # pick your project
   npm run deploy                # builds, then deploys hosting + firestore rules + storage rules
   ```
   The first time, the CLI asks to let Storage rules read Firestore (they check who is an
   admin). Answer **yes**.
7. **Allow streaming with the equaliser (CORS).** In Google Cloud Shell, run:
   ```bash
   gsutil cors set storage-cors.json gs://YOUR_BUCKET
   ```
   Without this, audio still plays, but the equaliser and volume boost can't process it.
8. Open `https://YOUR_PROJECT.web.app`, sign up, and **immediately** go to
   **Settings → Claim ownership**. From then on you are the owner and first admin, and nobody
   else can claim it.
9. Upload stories from the **অ্যাডমিন** tab.

If the app is opened without a Firebase config, it shows a one-time setup screen where the
config can be pasted instead of using `.env.local`.

**Content rights:** only upload recordings you own or have permission to distribute. Most
radio dramas and published stories (for example Sunday Suspense episodes, or the Feluda and
Byomkesh books) are under copyright.

## Development and tests

```bash
npm install
npm test                 # unit tests: ID3 + chapters, filenames, genres, storage, sync merge
npm run emulators        # local Firebase (auth, firestore, storage) — needs Java
npm run dev:emulators    # the app against the emulators (uses .env.emulators, no real project)
npm run test:rules       # 32 security-rule checks against the emulators
npm run build            # production build into dist/
```

`test/rules.test.mjs` checks, among other things, that:
- listeners can't write the catalogue, read drafts, read other people's data, or make
  themselves admin
- signed-out visitors can't read stories or get stream URLs
- ownership can only be claimed once
- the owner can't be removed
- demoted admins lose write access
- only admins can upload, and only audio or image files
