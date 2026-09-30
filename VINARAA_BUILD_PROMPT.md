# VINARAA — Master Build Prompt (give this whole file to Antigravity)

You are building **Vinaraa**, a premium Android music app for me and a few friends (private use, sideloaded APK).
Build the ENTIRE app end to end. Do not stop after scaffolding. Work in phases (section 14), run the app after each phase, and fix errors before moving on.

**The backend already exists and is finished.** It is in the folder `backend/` (Node + Express + MongoDB, 95/95 smoke tests pass). DO NOT rewrite it. Read `backend/README.md` and `backend/src/routes/*.js` first and build the app against those exact endpoints. Only touch the backend where this document says so (section 11).

---

## 1. Stack (decided, do not substitute)

- **Shell:** Capacitor 6+ (Android only for now). App name `Vinaraa`, package `com.vinaraa.app`.
- **UI:** React 18 + TypeScript + Vite + Tailwind CSS.
- **Animation:** Framer Motion (shared-element `layoutId` transitions, springs, gestures, scroll-linked `useScroll` / `useTransform`).
- **Routing:** React Router with a custom animated stack navigator (section 6).
- **Data:** TanStack Query (server state), Zustand (player/UI state), IndexedDB via `idb` (offline cache, tracking queue).
- **Icons:** `lucide-react`. **Fonts:** `@fontsource/sora` (headings) + `@fontsource/plus-jakarta-sans` (body), imported locally so they work offline. No Google Fonts CDN.
- **Charts:** Recharts (or visx). **Color extraction from artwork:** `node-vibrant`.
- **Native (Kotlin) Capacitor plugin `VinaraaPlayer`:** Media3 ExoPlayer + MediaSessionService + OkHttp. Section 8.
- **Push:** OneSignal (NOT Firebase in code). Note: OneSignal on Android still needs an FCM service-account JSON uploaded once in the OneSignal dashboard. That is dashboard setup only, no Firebase SDK in the app. Do this in the last phase.
- All screens must work at widths 320px to 430px, safe-area aware (`env(safe-area-inset-*)`), full-screen edge-to-edge with transparent status and nav bars.

## 2. Design language

Mood: dark, premium, glassy, neon-violet. Inspired by the three reference images I attached (see section 5 for exactly what to take from each).

### Color tokens (Tailwind theme + CSS variables)
| Token | Hex | Use |
|---|---|---|
| `bg` | `#0A0A18` | app background |
| `surface` | `#14142B` | cards, sheets |
| `surface-2` | `#1D1D3A` | raised cards, inputs |
| `border` | `#2A2A4A` | hairlines |
| `text` | `#F4F3FF` | primary text |
| `muted` | `#9A98BD` | secondary text |
| `primary` | `#8B3DFF` | main buttons, active states |
| `primary-soft` | `#B57BFF` | links, highlights |
| `accent` | `#FF3D8E` | likes, live/now-playing, badges |
| `mint` | `#2DE1B5` | success, "match %" chips, positive stats |
| `amber` | `#FFC247` | warnings |
| `danger` | `#FF5470` | errors |

Rules: one primary (violet) + one accent (pink). Mint only for success and match %. Gradients are allowed ONLY for (a) primary buttons (`#8B3DFF` to `#B57BFF`), (b) the artwork-tinted backgrounds below. Text on `primary` is white; all text must pass 4.5:1.

### Dynamic artwork tint (signature feature, from reference 2)
For player, album, artist, and playlist headers: extract the dominant + muted swatch from the artwork with node-vibrant, then render a full-bleed background of that color darkened to about 35% lightness fading to `bg` at the bottom, with a soft blurred copy of the artwork at 40% opacity. Crossfade the tint over 600ms when the song changes. Cache swatches per song id in IndexedDB.

### Shape, glass, depth
- Radii: cards 24px, sheets 32px top, buttons pill (999px), artwork 20 to 32px.
- Glass surfaces (bottom nav, control panel, mini-player): `backdrop-filter: blur(24px)` on **small areas only**, `rgba(20,20,43,.72)` with a 1px `border` at 60% opacity. Never blur full-screen layers (performance).
- Shadows are soft and colored (`0 20px 40px -20px rgba(139,61,255,.45)`).
- Typography: Sora 700 for titles (28 to 40px, tight tracking -0.02em), Plus Jakarta Sans 400/600/800 for body (14 to 16px). Big artist and song titles are large and confident like reference 2.
- Touch targets at least 44px. Every icon-only button has `aria-label`.

## 3. Motion system (implement as shared tokens in `src/motion.ts`)

- Springs: `snappy {stiffness:420,damping:34}`, `soft {stiffness:220,damping:26}`, `sheet {stiffness:300,damping:32}`.
- Durations: micro 150ms, standard 280ms, page 420ms. Easing `cubic-bezier(.2,.8,.2,1)`.
- **Animate only `transform` and `opacity`** (plus `filter` sparingly). Virtualize long lists (`@tanstack/react-virtual`). Respect `prefers-reduced-motion` (replace with fades).
- Required animations (all of these, not optional):
  1. **Splash to app:** logo bars animate as an equalizer for about 1.2s, wordmark fades up, then the splash scales and fades into the first screen. The Android 12 system splash uses the same background color `#0A0A18` and logo so the handoff is invisible.
  2. **Shared-element expand:** tapping a search result, album card, artist avatar, or playlist card expands the tapped element (via `layoutId`) to fill the screen while the rest of the list fades and shifts away. Closing reverses it. Same for tapping the mini-player: its artwork and title fly into the full player.
  3. **Full player sheet:** drag down to dismiss with rubber-band and velocity; background dims as it moves.
  4. **Bottom nav:** floating glass pill. The active tab has a violet blob that slides between tabs with the `snappy` spring (`layoutId`), the icon lifts 2px, and the label fades in beside the icon.
  5. **Page transitions:** forward = new page slides in from the right 24px + fade, old page shifts left 12px and dims. Back = reverse. Tab switches = crossfade + 8px vertical shift, no horizontal slide.
  6. **Scroll-linked:** large collapsing headers (title shrinks from 40px to 18px and the tint blurs into a solid bar), parallax on hero artwork (0.5x), cards in rails scale 0.94 to 1 and fade as they enter the viewport, sticky section headers.
  7. **Lists:** staggered entrance (40ms per item, max 8 items), swipe-left on a queue/playlist row to remove, long-press-drag to reorder with a lift shadow.
  8. **Play/pause:** icon morphs (path morph), button does a tiny press-scale 0.94. Now-playing rows show an animated 3-bar equalizer in `accent`.
  9. **Like:** heart pops (scale 1.35 then settle) with a 6-particle burst.
  10. **Seek bar:** a waveform-style bar (reference 3) that grows in height under the thumb while dragging and shows a time bubble.
  11. **Bottom sheets** (save to playlist, queue, sleep timer, output device): slide up with `sheet` spring, drag handle, scrim fades.
  12. **Skeleton loaders** with shimmer for every network list. **Pull-to-refresh** on Home and Library.
  13. **Onboarding chips:** tapping selects with a scale-pop and check icon; the "Continue" button label updates live ("Continue · 4 picked").
  14. **Lyrics:** the active line scales to 1.0 and turns `text` color, other lines 0.6 opacity; smooth auto-scroll to keep the active line centered; tap a line to seek.
  15. **Toasts** slide down from the top with the status bar inset.

## 4. Navigation and back-button behavior (critical)

- Bottom tabs: **Home, Search, Library, Stats**. Profile/Settings open from the avatar on Home.
- Implement an explicit navigation stack per tab (each tab remembers its own history and scroll position).
- Android back (Capacitor `App.addListener('backButton')`, and enable predictive back):
  1. If a bottom sheet / full player / modal is open, close it.
  2. Else if the current tab's stack has more than one page, pop it.
  3. Else if the current tab is not Home, switch to Home.
  4. Else (root of Home): call `App.minimizeApp()`, **never exit**, so music keeps playing. Exception: if the app was just launched and the user has not navigated at all, then minimize as well (same behavior; never call `exitApp`).
- The native player service keeps running in the foreground when the app is minimized or swiped away.

## 5. Reference images: exactly what to take from each

**Reference 1 (Discover, yellow on black):**
- The **stacked card carousel**: a large hero card that overhangs the header, with the next card peeking at the right edge; swipe to snap between playlists. Title bottom-left, round play button bottom-right, both over the artwork.
- The **vertical rotated label** ("Your playlist") on the left edge of the header as a tab.
- The header shape: a big rounded panel behind the carousel. In Vinaraa use the artwork tint color instead of yellow.
- Simple song rows: 48px rounded thumbnail, title/artist, duration on the right.
- The **floating pill nav** with a circular highlighted active tab.

**Reference 2 (artist page + player, red glass):**
- **Artist page:** full-bleed artist photo behind a huge artist name, "N listeners this month" beneath it, a rounded dark sheet sliding up containing "Popular songs" (rows with "..." menu, "All songs >" pill) and "In playlists" (colorful rounded cards with big titles).
- **Player:** whole screen tinted with the artwork's color, large rounded artwork, centered title and muted artist, a **glass control panel** at the bottom holding shuffle, previous, a large white/violet rounded-square play/pause, next, repeat, plus the progress bar with times. Back chevron top-left, heart top-right.

**Reference 3 (Qenara, purple neon set) — use for many screens:**
- **Welcome/intro** screen: large faded collage background, big headline with one accent-colored word, single "Let's Get Started" button, stepper lines at the top.
- **Login / Register / Forgot / "Check your mail" modal:** dark cards with leading icons in inputs, eye toggle, "Remember me" toggle, big violet button, `OR` divider, round social buttons row (render Google/Apple as **disabled, "Coming soon"**; the backend only supports email + password), "Don't have an account? Sign up" footer. The "Check your mail" modal with mint icon and "Open Email App" button.
- **Genre/language accordion** cards with expandable chip lists (use this look for the onboarding language + genre steps).
- **Trending list rows:** thumbnail, title/artist, duration, small circular play button; the currently playing row is highlighted with a violet-tinted background and a live equalizer.
- **Artist grid + Follow buttons** and an alphabet filter chip bar (A B C D ...). "Follow" maps to favoriting an artist in taste (see section 10).
- **Player variant:** circular artwork with a glow, a **waveform seek bar**, an action row (queue, like, artist, more), and a "Lyric" pull-up handle at the bottom that opens lyrics as a sheet.
- Compact **mini-player** above the nav with skip/pause and a thin progress line.

Do NOT build the Events screens from reference 3 (no backend for events).

## 6. Full screen inventory (build all of them)

**Auth & entry**
1. Splash (animated, section 3.1). Also handles token check + config fetch, then routes to Welcome/Home/Onboarding.
2. Welcome/intro (first launch only).
3. Login. 4. Register (name, email, password, confirm; password strength meter). 5. Forgot password. 6. "Check your mail" modal. 7. Reset password (token field + new password).
8. **Onboarding** (5 steps, each a full screen with progress bar, back arrow, Skip): languages, favorite movies, heroes (actors), singers, music directors. Data from `GET /onboarding/bundle?language=` (use `/onboarding/options?type=&q=` for search-within-step). Finish with `POST /onboarding/complete`. Show a celebratory "Building your mix..." animation while it runs.

**Main**
9. **Home:** greeting + avatar, language chips, Discover-style stacked carousel (from `/recommendations/feed` first rail), then rails: Picked for you (with match % chip in mint and the `reason` text), Because you like [movie], New in your languages (`/music/modules`), Trending (`/music/trending`), On repeat, Recently played, Your Taste Mix. Pull to refresh.
10. **Search:** search bar that expands from the tab; recent searches (`/users/me/search-history`, swipe to delete, clear all); live type-ahead (`/music/search/suggestions`); results with tabs All / Songs / Albums / Artists / Playlists (`/music/search`); tapping a result plays it and offers "add to queue". Debounce 250ms; keep a local cache for offline.
11. **Album/Movie page:** tinted header, parallax art, movie name, year, language, cast row (heroes) + music director + singers as tappable chips, Play/Shuffle/Download all, track list.
12. **Artist page** (reference 2 layout): popular songs, albums, "affinity %" from `/recommendations/entity/:type/:id`, Follow button.
13. **Editorial/system playlist page** and **user playlist page:** tinted header, play/shuffle, download toggle, reorder mode, rename, delete, duplicate, public toggle, "add songs".
14. **Library:** tabs Playlists / Liked / Downloads / Artists. System playlists pinned (Liked Songs, On Repeat, Your Taste Mix, Recently Added from `/playlists/system`). "New playlist" FAB.
15. **Save to playlist bottom sheet** (from any song "..." or heart-long-press): list of playlists with checkmarks, "New playlist" row. If the user creates one without typing a name, send no name; the backend names it "Playlist N" (`/playlists/name-suggestion` prefills the field as a placeholder). Use `POST /playlists/save-song`.
16. **Full Player:** see section 7.
17. **Queue sheet:** Now playing, Next up (drag to reorder, swipe to remove), Play history (previous songs stack), "Clear queue", autoplay toggle.
18. **Stats dashboard** (`GET /stats/dashboard`): range chips (24h, 7d, 30d, 90d, 180d, All); hero card with total listening time and the written insight sentences from `/stats/insights` as swipeable cards; timeline area chart; 7x24 heatmap; top songs / movies / singers / directors / actors / languages with animated horizontal bars; listening quality (completion vs skip) donut; recently played; listening history list (`/stats/history/sessions`). Charts animate in on first view and on range change.
19. **Profile:** avatar, name, taste summary (`/users/me`), edit taste seeds (reopens onboarding steps), export data (`/users/me/export`), logout, logout all, delete account (type DELETE).
20. **Settings:** audio quality (12/48/96/160/320 kbps, Wi-Fi vs mobile), data saver, autoplay, crossfade, equalizer preset (native Media3), download quality + Wi-Fi only, sleep timer default, notifications (per type), active sessions/devices (`/auth/sessions`, remote logout), clear cache, about/version.
21. **Downloads manager:** progress rings, pause/resume, storage used, delete.

**System pages (must work with NO internet, all bundled)**
22. **Offline page:** animated illustration, "You're offline", button to open Downloads, auto-retry when `Network` plugin reports online.
23. **Not found (404).** 24. **Server unreachable / maintenance** (backend down; show cached content link). 25. **Generic error boundary** with "Try again".

## 7. Full Player spec

- Opens from the mini-player via shared-element expand. Layout top to bottom: back chevron, "PLAYING FROM {album/playlist}", "..." menu; **segmented switch: Photo | Lyrics | Info**; content area; title/artist row with heart; waveform seek bar with times; control panel; bottom row.
- **Photo:** big artwork with tint background and gentle breathing scale while playing. **Lyrics:** synced if available (`/music/songs/:id/lyrics`), else plain scroll, font size control, tap-to-seek. **Info (meta):** movie, year, language, label, heroes/cast chips, singers, music director, album, quality, play count; every chip opens its page.
- **Controls:** shuffle, previous (if position > 3s restart, else previous song from history stack), play/pause, next, repeat (off / all / one, with a "1" badge), like, add to playlist, download, share (text), sleep timer (15/30/45/60/end of song), playback speed (0.75x to 1.5x), queue.
- **Output device button:** shows current route (Speaker / Headphones / Bluetooth device name) using the native plugin's audio-route listener, and opens the system output switcher (`MediaRouter` / `AudioManager`). Show a toast when headphones connect or disconnect; **pause when headphones unplug**; respect audio focus (pause on call, duck on notifications).
- Swipe left/right on the artwork = next/previous. Double-tap artwork = like.
- Previous/next always work from the real history stack + queue; autoplay pulls from `/recommendations/next?currentSongId=` when the queue ends.

## 8. Native plugin `VinaraaPlayer` (Kotlin, Media3)

Build as a local Capacitor plugin inside `android/`. Responsibilities:
1. `MediaSessionService` with ExoPlayer, foreground notification (MediaStyle), lock-screen + Quick Settings controls, Bluetooth/car/headset button support, artwork, duration, position, next/previous/seek/like custom actions. Set complete `MediaMetadata` (title, artist, album, artwork URI, duration) so Samsung Now Bar / Pixel media chips render it. **No overlay permission, no Live Update API.**
2. **Authenticated streaming:** `GET /music/stream/:id?mode=proxy&quality=` requires `Authorization: Bearer`. Use an OkHttp `DataSource.Factory` with an interceptor that adds the current access token and supports `Range` for seeking. Cache with `SimpleCache` (LRU 500 MB) and use `CacheDataSource`.
3. **Token ownership:** the native side owns token refresh (single owner, because refresh tokens rotate and reuse revokes the whole family). Store tokens in EncryptedSharedPreferences. On 401, call `POST /auth/refresh` once (mutex), save the NEW pair, retry. The JS layer asks the plugin for API calls' token or delegates its own requests through a shared refresh lock exposed by the plugin. There must never be two refreshers.
4. **Tracking (server-authoritative time):** natively call `POST /tracking/sessions` when a song starts, `POST /tracking/sessions/:id/heartbeat {positionMs, state}` every 10 to 15 s and on every state change/seek, `POST /tracking/sessions/:id/end {positionMs}` on stop/next. `state` is `playing | paused | buffering`. Send only the playhead; the server decides credited time. Also post `events` for like, skip, seek, queue_add. Persist unsent events in a Room DB and flush with `POST /tracking/sync` when back online (offline sessions are clamped server-side). Works while the WebView is asleep.
5. **Downloads:** native `DownloadManager`/Media3 `DownloadService` writing encrypted files to app storage; expose progress events; play downloaded files offline; Wi-Fi-only option.
6. **Audio routing events** (headphones/BT/speaker), audio focus, sleep timer, playback speed, crossfade, equalizer.
7. Plugin API to JS (typed in `src/native/player.ts`): `setQueue`, `play`, `pause`, `next`, `previous`, `seekTo`, `setRepeat`, `setShuffle`, `getState`, `addListener('state' | 'position' | 'route' | 'download' | 'trackChanged')`, `setAuth`, `startDownload`, `setSleepTimer`, `setSpeed`.
8. **Widget-ready architecture (future phase):** keep a single `PlayerStateStore` (Kotlin, backed by DataStore) holding current song, artwork path, position, isPlaying, queue preview. The notification and app both read it. Do not couple UI to the store implementation, so Jetpack Glance home-screen widgets (now-playing, quick-play Taste Mix, stats glance) can be added later without refactoring. Add `// WIDGET-HOOK` comments where widgets will subscribe.

## 9. Offline, splash and resilience

- The whole web bundle ships inside the APK (`webDir: dist`), so splash, offline, 404, error and Downloads screens need no network.
- Read-through cache for search suggestions, Home rails, playlists, stats (stale-while-revalidate); show a small "Offline" pill in the header when disconnected.
- Config resilience: the backend base URL comes from `VITE_API_BASE_URL` at build time AND can be overridden in Settings (hidden 7-tap on version). If the primary URL fails, show the "Server unreachable" page. Upstream worker rotation is handled by the backend admin API, never by the app.
- Handle `429` with a friendly retry-after message and exponential backoff. Handle the backend error envelope `{success:false, error:{code,message}}` centrally.

## 10. Backend contract (use `backend/` as the source of truth)

- Base `/api/v1`. Success `{success:true,data,meta?}`, failure `{success:false,error:{code,message,details?}}`. Build a typed client with zod validation of responses.
- Auth: `/auth/register`, `/login`, `/refresh` (rotating), `/logout`, `/logout-all`, `/change-password`, `/forgot-password`, `/reset-password`, `/sessions`. Always send a `device` object on register/login (id, name, platform: android).
- Follow artist: implement as adding to taste seeds via `PUT /users/me/taste-seeds` (read `user.routes.js` and `schemas.js` for the exact shape).
- Recommendation order is fixed by the backend (movie, hero, language, singer, music director). Show `matchPercent` as a mint chip and `reason` as small text. Do NOT invent mood/theme tags; the API does not provide them.
- Stream URLs, tracking, playlists, stats, onboarding, notifications: follow `backend/README.md` and the Postman collection in `backend/postman/`.
- Likes: `POST /playlists/liked`; is-liked: `GET /playlists/liked/:songId` (batch-check client-side and cache).

## 11. Allowed backend changes

1. Add a `notifications` provider for **OneSignal** REST API inside `deliverPush()` in `backend/src/routes/notification.routes.js` (env `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`), keeping the honest `push_provider_not_configured` response when unset. Register the OneSignal player/subscription id through the existing device-registration endpoint.
2. If you find a real bug while integrating, fix it and add a smoke-test case. Do not change route shapes the app depends on.

## 12. Project structure to create

```
vinaraa/
  backend/            (existing, untouched except section 11)
  app/
    src/
      motion.ts  theme/  components/  screens/  navigation/
      api/  store/  native/  hooks/  lib/  assets/
    android/          (Capacitor project + VinaraaPlayer plugin)
    capacitor.config.ts   (appId com.vinaraa.app, appName Vinaraa, webDir dist)
    .env.example          (VITE_API_BASE_URL)
  README.md           (setup + run guide, section 13)
```

## 13. Run guide (also write this into README.md)

Prerequisites: Node 20+, Android Studio (SDK 34+, an emulator or a USB phone with USB debugging), JDK 17.

Backend first:
```bash
cd backend && npm install && cp .env.example .env   # fill MONGODB_URI, JWT secrets, ADMIN_API_KEY, UPSTREAM_URLS, UPSTREAM_PATH_PREFIX=/api
node scripts/ensure-indexes.js && npm start          # http://localhost:8080
```
App:
```bash
cd app && npm install
cp .env.example .env        # emulator: VITE_API_BASE_URL=http://10.0.2.2:8080/api/v1
                            # real phone on same Wi-Fi: http://<your-PC-LAN-IP>:8080/api/v1
                            # deployed: https://<your-render-app>.onrender.com/api/v1
npm run dev                 # fast UI work in the browser (Chrome device toolbar, 390x844)
npm run build
npx cap add android         # first time only
npx cap sync android
npx cap open android        # opens Android Studio -> press Run on an emulator/phone
```
Faster loop on device: `npx cap run android --livereload --external`. For HTTP (non-HTTPS) local backends, allow cleartext traffic for debug builds only through a `network_security_config`. Release: Android Studio, Build, Generate Signed Bundle/APK, APK, then send the APK to friends (Play Store will not accept unofficial streaming sources).

Native plugin changes need a rebuild in Android Studio; web changes only need `npm run build && npx cap sync`.

## 14. Build phases (run and verify after each)

1. Scaffold app, theme tokens, fonts, motion tokens, navigation stack + back-button logic, typed API client, auth screens, token refresh, splash + system pages.
2. Native `VinaraaPlayer`: stream a song with auth, notification, seek, tracking heartbeat. Test with the backend's `/tracking` and `/stats/verify-tracking`.
3. Onboarding (5 steps) + Home + Search.
4. Album / Artist / Playlist pages with shared-element transitions; Save-to-playlist sheet; Library; Liked.
5. Full Player (Photo/Lyrics/Info), Queue, previous/next history, autoplay, output device, sleep timer.
6. Downloads + offline mode + offline sync queue.
7. Stats dashboard + Profile + Settings.
8. OneSignal push, polish pass (performance profiling on a mid-range phone, reduced-motion, accessibility labels), signed release APK.
9. (Later, separate request) Home-screen widgets via Jetpack Glance using `PlayerStateStore`.

## 15. Quality bar (definition of done)

- Every screen in section 6 exists, is reachable, and uses real backend data (no lorem ipsum, no fake stats).
- 60fps scrolling/animations on a mid-range phone; no layout shift; no animation on non-transform properties.
- Back button behaves exactly as in section 4. Music never stops when the UI is closed or minimized.
- Tracking credits ~0 for skips to the middle/end (verify with `/stats/verify-tracking`).
- Works offline for splash, offline, 404, Downloads, and cached rails.
- Provide a short `README.md` with the run guide and a `docs/ARCHITECTURE.md` that explains token ownership, tracking flow, and where widgets will plug in.
