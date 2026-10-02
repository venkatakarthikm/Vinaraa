# VINARAA — MASTER BUILD ORDER v2 (for Antigravity)

> **Audit basis:** `github.com/venkatakarthikm/Vinaraa` cloned and read line-by-line on 2026-10-02.
> `app/` = Vite + React 19 + Tailwind v4 + Capacitor 8 Android (minSdk 24, targetSdk/compileSdk 36, Media3 **1.3.1**).
> `soundwave-backend/` = Node/Express/MongoDB (JioSaavn proxy) deployed on Render; upstream = the Cloudflare Worker (`https://jiosaavn-api.apicoolie.workers.dev`, requires the `/api` prefix).
>
> **Two tags are used everywhere in this file:**
> - **[CONFIRMED]** = I read this in the source; the file path + line number is given.
> - **[VERIFY]** = strong inference from the code that Antigravity must reproduce on a device **before** changing it.
>
> **The single hardest rule:** **Do NOT touch the visual design of `src/screens/FullPlayer.tsx`.** The owner redesigns that screen himself later. You may change **logic only** (progress sync, back handling, store selectors, duplicate tracking removal, lyrics reset, gestures in FEATURE-01) and every touched line must carry a `// VINARAA-FIX:` comment.
>
> **Verdict on the previous instruction file:** it is a good, 80 %-correct work order. **It is not sufficient as-is** — it contains 3 factual errors, misses 14 code-level causes (including the exact mechanism behind "music works but stats/playlists/account 401"), and never mentions the bandwidth architecture that decides how downloads and streaming must be built. All corrections are in §0.4–§0.6 and marked in Part A.

---

## 0. READ FIRST — verdict, corrections, gaps

### 0.1 Answer to the two architecture questions (decides half of Part A)

| Question | Verified answer |
|---|---|
| "Does the audio come straight from the JioSaavn CDN, so my 5 GB Render bandwidth is safe?" | **Yes for playback — as long as nothing changes.** `formatPlayerSong` (`app/src/utils/song.ts:17-21`) picks `song.audio.best` first. The backend's `catalog.toClientSong` fills `audio.best` with the **direct `aac.saavncdn.com` URL** (`soundwave-backend/src/services/catalog.js:135-176`). ExoPlayer therefore streams from the JioSaavn CDN and **Render never sees the bytes**. |
| "…and all API requests come from Cloudflare, right?" | **No.** The app talks to Render: `API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://vinaraa.onrender.com/api/v1'` (`app/src/api/client.ts:6`). Render then calls the Cloudflare Worker as *its* upstream (`render.yaml` → `UPSTREAM_URLS` + `UPSTREAM_PATH_PREFIX=/api`). So: **App → Render → Cloudflare Worker → JioSaavn.** |
| ⚠️ The trap you must not fall into | `soundwave-backend/src/routes/music.routes.js` also exposes `GET /music/stream/:id`, which **proxies the audio through Render** (`Readable.fromWeb(upstream.body).pipe(res)`, Range passthrough). The app currently never calls it, but (a) the download fix below must **never** use it, and (b) `toClientSong` emits `audio.streamUrl: '/api/v1/music/stream/<id>'` as a **relative path with no host** — if any future code uses `audio.streamUrl` it will break (relative URL) *and* burn Render bandwidth. Fix both (§A15). |

### 0.2 Rule set for the whole job

1. Build + verify in the browser first (`npm run dev`), then `npm run android` (= `tsc -b && vite build && npx cap sync android`), then device test. **Never edit inside `android/app/src/main/assets/public`** — generated.
2. **Single source of truth for playback = native ExoPlayer (Media3).** The zustand store is a *mirror* + the queue list. JS must never rebuild the native queue to do next / previous / play-next (today it does — §A01/§A03).
3. Tailwind v4 only. Delete `tailwind.config.js`, the `@config` line, and the hand-written `.bg-bg/.text-muted/...` shims at the bottom of `index.css` (they bypass the theme and break opacity modifiers). All tokens in `@theme` (§C-2).
4. Every async surface has **4 states**: loading (skeleton), empty, error (+Retry), success. Every control has default / pressed / disabled / loading.
5. TypeScript strict; replace `any` in new code; `npm run lint` + `tsc -b` clean at the end of every phase.
6. Respect `prefers-reduced-motion`; touch targets ≥ 48×48 dp.
7. `gsk`-style logging: add `src/utils/log.ts` (`log.player/net/ui`) that is a no-op in production; replace `console.log` (§B-1).
8. Every fix in FullPlayer is logic-only and tagged `// VINARAA-FIX:`.

### 0.3 Execution order (do not reorder)

`P0` safety branch → `P1` auth/tokens → `P2` player core → `P3` network/offline/downloads → `P4` launch/splash → `P5` design foundation → `P6` screens → `P7` FullPlayer gestures → `P8` performance + QA. (Full detail in Part D.)

### 0.4 Factual errors in the previous instruction file — FIX THESE

| # | The old file says | The code says | What to do |
|---|---|---|---|
| E-1 | (BUG-10) implies removing "refresh tokens" is enough for a never-expiring token | `signAccessToken` sets `expiresIn: env.ACCESS_TOKEN_TTL` with `ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL \|\| '365d'` (`soundwave-backend/src/services/tokenService.js:13-24`, `config/env.js:29`). The token **does expire** (365 d, or whatever the Render dashboard sets). | Remove the `expiresIn` option entirely (no `exp` claim). See §A10. |
| E-2 | (BUG-09.14) "`PlaybackService.kt` has dead `ACTION_NEXT/PREVIOUS` receiver + receiver in the plugin" | **Not found.** `PlaybackService.kt` contains only the `ExoPlayer.Builder` block (lines 30-31) and `release()` (57-58). The plugin registers a `MediaController.Callback` (`VinaraaPlayerPlugin.kt` ~130-147), which is *live*, not dead. | Drop this task. Do not delete the controller callback. |
| E-3 | (BUG-08) "the manifest icon is a plain PNG" | Correct **and worse**: a correct adaptive icon **already exists** (`res/mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml`) but the manifest ignores it and points at `@drawable/vinaraa` (`AndroidManifest.xml:6,8`). | Just repoint the manifest + add the splash icon layer (§A08). |

### 0.5 Extra root causes the old file missed (all **[CONFIRMED]**)

| ID | Finding (file:line) | Why it matters |
|---|---|---|
| **N-01** | `app/src/store/auth.ts:20` writes **`refreshToken: ''`** into native prefs; `app/src/api/client.ts:35-41` reads it and bails out when it is empty (`if (!refreshToken) return null`). | 🔴 **This is the real mechanism of "music works but playlists/account/stats fail".** The refresh path is *structurally dead*: a refresh is attempted only for `TOKEN_EXPIRED`, gets `null`, the original 401 is re-thrown, and every user-bound screen fails until the user logs out/in. Exactly your symptom. |
| **N-02** | `app/src/api/client.ts:118` refreshes **only** `TOKEN_EXPIRED`; the 401 branch that logs out only matches `['SESSION_REVOKED','REFRESH_INVALID']` (line 134). `TOKEN_INVALID` / `USER_NOT_FOUND` are **never handled**. | Zombie session: still "logged in", every user API 401, no message, no logout. |
| **N-03** | `app/src/store/auth.ts:40-67` `checkAuth()` trusts the stored token without ever validating it; on a plugin race it *keeps* the previous state. | A dead token looks like a live login on cold start. |
| **N-04** | `soundwave-backend/src/services/catalog.js:176` returns `audio.streamUrl` as a **relative** path (`/api/v1/music/stream/<id>`) → unusable by a native client. | Silent breakage for any future consumer; also the bandwidth trap (§0.1). |
| **N-05** | `soundwave-backend/src/middleware/auth.js:20-21` maps expiry to `TOKEN_EXPIRED`; `optionalAuth` **swallows** every auth error (`catch { /* treat as anonymous */ }`, line 57). | Explains why `/music/*` "works fine" anonymously while `/stats`, `/playlists`, `/users`, `/tracking` die. Keep the swallow, but add the `X-Auth-State: invalid` header (§A10). |
| **N-06** | `render.yaml` sets `JWT_ACCESS_SECRET: generateValue: true` **and** `JWT_REFRESH_SECRET: generateValue: true`. | Every blueprint re-sync silently regenerates the secret → **all existing tokens become `TOKEN_INVALID`** (see N-02 → zombie session). Must be a fixed, never-regenerated value. |
| **N-07** | `AndroidManifest.xml:5` `android:allowBackup="true"` while the JWT lives in plain `SharedPreferences` (`VinaraaPlayerPlugin.kt:186-203`). | The access token is backed up to Google Drive / extractable by `adb backup`. With a never-expiring token this becomes a permanent credential leak. Must be `false` + EncryptedSharedPreferences. |
| **N-08** | `AndroidManifest.xml:54-56` still requests `WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_AUDIO`, yet the downloader uses `DownloadManager` into public Music with **no runtime-permission request anywhere** (`VinaraaPlayerPlugin.kt:383-402`). minSdk is **24**. | On API 24-28 the download **silently fails** — one of the two reasons "download doesn't work" (the other is §A06). Play Store also flags the permissions. |
| **N-09** | `app/src/screens/Search.tsx:82-90` and `Home.tsx:182-184` call `setShowPlayer(true)` **and** `navigate('/player/<id>')` when playback starts. | Combined with §A04 this is why the nav disappears and why the back stack gets confusing. Player opening must be min-player/gesture driven, never a *pushed route per song*. |
| **N-10** | `app/src/screens/Search.tsx:70-72` renders `users.searchHistory()` rows (shape `{query, scope, resultCount}` — `soundwave-backend/src/models/SearchHistory.js`) as if they were entity cards. The backend has **no "clicked entity" record at all**. | Your "last 8 items as preview cards, tap → open album/artist/playlist" is **not a tweak — it needs a new local store + a new backend field/endpoint** (§C-8.7, checklist P6). |
| **N-11** | `app/src/screens/Settings.tsx:45,56-58` call `setQuality(v); savePrefs();` — `savePrefs` closes over the **previous** `useState` value, and nothing is ever read back from `users.me().preferences`. The backend *does* honour quality: `music.routes.js` `/stream/:id` reads `req.user.preferences.audioQuality`. | Settings never persist and never reach playback. Fix with a real mutation (§A11). |
| **N-12** | `MainActivity.kt:5-10` / `res/values/styles.xml`: `AppTheme` parents **`Theme.AppCompat.NoActionBar`** and hard-codes `#090714` in `windowBackground`, `statusBarColor`, `navigationBarColor`. There is **no `values-night/`**. | A light theme is **impossible** at native-chrome level until the parent becomes `Theme.AppCompat.DayNight.NoActionBar` (+ `values-night/colors.xml`). The old file only asked for `values-night` colours. |
| **N-13** | No `useQuery` / `useMutation` exists anywhere in `app/src` (grep is empty) although `@tanstack/react-query` is installed and a provider is mounted (`App.tsx:60-70`). | Every screen hand-rolls `useState` + `useEffect` + `setInterval` (`Home.tsx:173`). All data plumbing must move to React Query (§B-1). |
| **N-14** | `app/src/index.css:24-30` sets `touch-action: pan-y` on `body` and `overflow: hidden !important` on `html, body, #root`, plus global `user-select: none` and `scrollbar-width: none !important`. | Kills horizontal rails/swipe gestures in some views, blocks text selection in lyrics/inputs, and hides scroll feedback. Scope these per component (§A09.15). |

### 0.6 Vague / undecided in the old file — decide before coding

| ID | Open point | Recommendation |
|---|---|---|
| V-01 | Social login (Google/Facebook) — the old file says "UI only unless owner enables backend". | Build the buttons **disabled** with a "Coming soon" tooltip. No OAuth endpoint exists in `soundwave-backend/src/routes/auth.routes.js`. |
| V-02 | "Artists" tab in Library | There is **no follow/unfollow API**. Ship the tab only when the backend adds it; otherwise hide it (the old file notes this, it must be explicit in the acceptance test). |
| V-03 | "Never-expiring token" vs security | Accept it, but with the guard-rails in §A10 (EncryptedSharedPreferences, `allowBackup=false`, revoke-by-password-change, device list, TLS-only). A 400-day TTL is offered as the safer variant if you change your mind. |
| V-04 | "Export to Music folder" | Not in v1. App-specific storage only. |
| V-05 | Crossfade / gapless / normalize toggles in Settings | Only expose the ones that will actually be implemented in this phase; otherwise they are dead switches (worse than absent). |
| V-06 | `CapacitorHttp` | `capacitor.config.ts` has `CapacitorHttp.enabled: true`; it patches `fetch` and can break `AbortController`/Range/streaming. Recommended: **remove it** and rely on WebView `fetch` + CORS (`CORS_ORIGINS: "*"` in `render.yaml`). |

### 0.7 What the five attached screenshots actually show (used as the animation spec)

I read all five images. **Important:** none of them is a login/register screen — they show (a) the launcher icon on the home screen, and (b) three frames of the **app opening/expanding animation**. The login reference you mentioned is **not** among these five; send it separately if the auth screen must match it.

| Image | What is literally visible |
|---|---|
| 1 | Home screen, wallpaper, the Vinaraa app icon (dark rounded square with the violet→pink "V" mark) + label "Vinaraa", a 4-dot page indicator under it, and the dock (Phone, Messages, Camera, Instagram, WhatsApp). |
| 2 | Same home screen a moment later: a dark translucent **"Search" pill** (magnifier + the word) appears under the icon. Still launcher level — the app has not opened. |
| 3 | ⭐ **The transition.** The app is rendered as a **floating rounded card ≈ 65-70 % of screen height, centred**, the wallpaper and the dock still visible around it. Inside you can see the real Home screen (small-caps "GOOD EVENING", bold "karthik", bell in a dark circle, pink "K" avatar, a magenta "TOP PICK FOR YOU" hero card with a violet circular play button, "Jump Back In" 2-column grid). Corner radius of the whole app surface ≈ 28-32 px. |
| 4 | Same screen **nearly expanded**: it now fills almost the whole viewport but still shows rounded corners and a thin gap of wallpaper at the edges — and the **mini player has appeared** ("Chirunavve Visirave / Vijay Prakash" with a violet play circle and a next icon), plus a thin violet progress line at the very bottom of the card. |
| 5 | Fully settled: full-screen, no wallpaper, with the **bottom navigation bar** (Home active with a violet indicator, Search, a centre dot, a library/waveform icon, an equalizer icon). The mini player sits directly above the nav. |

**What this means for the "open from the tab" animation you asked for:** the reference is *content expanding out of the element you touched* — it starts **small + heavily rounded + offset**, then grows to full-screen while the radius goes to 0, and the navigation chrome (mini player, nav bar) **appears only in the last third** of the motion. Reproduce exactly that recipe for every tab tap and detail-page open (§C-5.2). The launcher-level frames (1, 2) are Android's own launch animation — you cannot restyle them, which is why §A08 must make the *native* splash and the *web* splash visually identical.

**Style words taken from the images (no guessing):** dark violet-navy canvas; magenta/rose album art as the only strong colour; a single violet accent for the play button, the active-tab indicator and the avatar; small-caps muted eyebrow text ("GOOD EVENING") above a heavy bold lowercase name; generous rounded corners everywhere (16 px cards, 28-32 px surfaces); thin outline icons (bell, next) next to solid filled play glyphs.

---

# PART A — BUGS, ROOT CAUSE, EXACT FIX (with checkbox tasks)

Severity: **P0** = broken feature / visible glitch · **P1** = wrong behaviour / performance · **P2** = polish.
Every **`file:line`** below was read in the clone (2026-10-02). Where I could not find the cause in code, the item is explicitly marked **[VERIFY]** or **[HYPOTHESIS]** — reproduce it first, then fix.

---

## A01 (P0) "Play next" (and "Add to queue") does nothing when the song comes from another album/playlist

**Symptom (your words):** playing from a playlist list works, but *Play next* from another playlist/album does nothing.

**Where:** `app/src/store/player.ts:89-100` (`playNext`), `app/src/store/player.ts:88` (`appendToQueue`), `app/src/player/engine.ts:38-117` (store→native subscriber), `app/src/utils/song.ts:15-38` (`formatPlayerSong`), `app/android/app/src/main/java/com/music/vinaraa/VinaraaPlayerPlugin.kt:208-233` (`setQueue`), `soundwave-backend/src/models/Playlist.js:9-30` (playlist track snapshot shape).

**Root cause — three faults that compound**

1. **[CONFIRMED] Playlist tracks have no audio URL, and Kotlin silently drops URL-less items.**
   A backend playlist stores a *self-contained snapshot* per track: `songId, name, subtitle, artistsText, image, durationMs, language, albumName, movieName, year` (`Playlist.js:9-30`) — **no `downloadUrls`, no `audio`**. In the app, `formatPlayerSong` builds `streamUrl` from `audio.best` → `audio.formats[last].url` → `downloadUrl[last].url`, and otherwise returns `''` (`utils/song.ts:17-21, 32`). Then native `setQueue` does `if (url.isEmpty()) continue` (`VinaraaPlayerPlugin.kt:218`) and, if everything was empty, `return call.reject("no playable items")` (line 233). So the inserted song is **dropped**, and — worse — if it was the item the user just pressed "Play next" for, *every index after it shifts relative to the JS queue*.
   *Why albums seem fine:* album songs come from `catalog.toClientSong`, which **does** include `audio.best` (`soundwave-backend/src/services/catalog.js:159-172`), so album items survive; playlist snapshots do not. That asymmetry is exactly your symptom.

2. **[CONFIRMED] `playNext` only splices the JS array → the engine rebuilds the whole native queue.**
   `playNext: (song) => { … updated.splice(currentIndex + 1, 0, song); set({ queue: updated }); }` (`store/player.ts:89-100`). The subscriber then fires because the length changed: `if (song && (song.id !== loadedId || s.queue.length !== lastQueueLength))` (`engine.ts:42`) and calls `VinaraaPlayer.setQueue({… positionMs: s.positionMs …})` (`engine.ts:64-75`) — a **full re-prepare** of the current song using a possibly stale position. So pressing "Play next" restarts/re-buffers the current song, and any URL-less item vanishes from the native queue.

3. **[CONFIRMED] Fragmenting the file name / no dedupe / no user feedback.**
   `appendToQueue` (`store/player.ts:88`) has the same rebuild problem; there is no de-duplication (the same song can be queued twice); and `SongActionSheet.handlePlayNext` (`SongActionSheet.tsx:27-31`) shows "Playing next" unconditionally — even when the native call failed, so the failure is invisible.

**Fix (do all of it)**

1. **Guarantee every queued song is playable.** New file `app/src/player/resolve.ts`:
   ```ts
   import { music } from '@/api/endpoints';
   import { formatPlayerSong } from '@/utils/song';
   import type { Song } from '@/store/player';

   /** Returns a Song guaranteed to have a non-empty streamUrl, or throws NO_STREAM_URL. */
   export async function ensurePlayable(song: Song): Promise<Song> {
     if (song.localPath) return song;          // downloaded file wins (A06)
     if (song.streamUrl) return song;
     const full = await music.song(song.id);   // GET /music/songs/:id  (endpoints.ts:72)
     const f = formatPlayerSong(full?.song ?? full);
     if (!f.streamUrl) throw new Error('NO_STREAM_URL');
     return { ...song, ...f };
   }
   ```
   Call it in **every** enqueue path: `setQueue` callers (`Album.tsx:26`, `Artist`, `PlaylistPage.tsx:59`, `Library.tsx:39/117`, `Home.tsx:182`, `Search.tsx:86`) and in `playNext` / `appendToQueue`. For a long list resolve **only the start song** up front and the rest lazily.

2. **Add real native queue editing — never rebuild.** New plugin methods in `VinaraaPlayerPlugin.kt` (+ declarations in `app/src/native/player.ts` and a no-op in `playerWebStub.ts`):
   ```kotlin
   @PluginMethod fun insertNext(call: PluginCall)  // addMediaItem(currentMediaItemIndex + 1, item)
   @PluginMethod fun appendItems(call: PluginCall) // addMediaItems(items)
   @PluginMethod fun removeAt(call: PluginCall)    // removeMediaItem(index)
   @PluginMethod fun moveItem(call: PluginCall)    // moveMediaItem(from, to)
   @PluginMethod fun skipToIndex(call: PluginCall) // seekToDefaultPosition(index)
   @PluginMethod fun setShuffle(call: PluginCall)  // p.shuffleModeEnabled = on
   @PluginMethod fun getQueue(call: PluginCall)    // ids + currentIndex (for reconciliation)
   @PluginMethod fun clear(call: PluginCall)
   @PluginMethod fun appReady(call: PluginCall)    // hides the native splash (A08)
   @PluginMethod fun setPlaybackContext(call: PluginCall) // {source, contextId} for tracking (A11)
   ```
3. **JS mirror + native edit.** In `store/player.ts`:
   ```ts
   playNext: async (song) => {
     const s = await ensurePlayable(song);
     const { queue, currentIndex } = get();
     if (!queue.length) return get().setQueue([s], 0);
     const at = currentIndex + 1;
     set({ queue: [...queue.slice(0, at), s, ...queue.slice(at)] });
     engine.markQueueMutation();                      // tells the engine: do NOT rebuild
     await VinaraaPlayer.insertNext({ item: toNativeItem(s) });
   },
   ```
4. **Fix the engine trigger** (see A03.2): rebuild **only** when a `queueVersion` bumped by `setQueue` changes — never on `queue.length`.
5. **De-duplicate:** if the song already exists later in the queue, `moveItem` it instead of inserting a second copy.
6. **UX:** success → toast "Will play next" with **Undo**; failure → toast "Couldn't add this song. Check your connection" — never fail silently.

**Debug first [VERIFY]:** log `log.player('enqueue', song.id, !!song.streamUrl)` in `playNext`/`appendToQueue`. If `streamUrl` is `false` you have reproduced cause 1 exactly.

**Acceptance:** Album A → play song 1 → Playlist B → ⋮ → *Play next* on song 5 → press Next in the mini player → song 5 plays **and the current song did not restart**; the queue sheet shows it in position 2; repeat from Search results, Artist and Library.

**Tasks**
- [ ] A01-1 `src/player/resolve.ts` created; `ensurePlayable` used by every enqueue path
- [ ] A01-2 `GET /music/songs/:id` reached when a song has no URL (verified in the network log)
- [ ] A01-3 Native `insertNext` / `appendItems` / `removeAt` / `moveItem` / `skipToIndex` implemented + typed + web-stubbed
- [ ] A01-4 `playNext` / `appendToQueue` use the native edit methods (no `setQueue` rebuild)
- [ ] A01-5 `queueVersion`-based rebuild rule in the engine (no length-based rebuild)
- [ ] A01-6 De-dupe by moving an existing later entry
- [ ] A01-7 Toast + Undo on success, error toast on failure
- [ ] A01-8 Tested from album, playlist, search, artist, library, downloads

---

## A02 (P0) Progress bar jumps / starts from the wrong place; glitches in loop mode

**Symptom (your words):** the time counter is fine but the bar sometimes starts somewhere other than 0 when the song loops.

**Where:** `app/src/components/MiniPlayer.tsx:9,12,55`, `app/src/player/engine.ts:42-88,119-141,148-151,174-195`, `app/src/store/player.ts:62-75,149-163`, `app/src/screens/FullPlayer.tsx:97-119,390`.

**Root cause**
1. **[CONFIRMED] The bar animates backwards.** `MiniPlayer.tsx:55`: `<div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />`. On a loop / track change `progress` goes ~1 → 0 and CSS **animates the width from 100 % down to 0 %**, which reads as "it started from somewhere else".
2. **[CONFIRMED] Wrong duration for ~0.5-2 s after a change.** The poll does `durationMs: nativeDur && nativeDur > 0 ? nativeDur : st.getState().durationMs` (`engine.ts:179-184`) — while the new item loads, native reports `-1`, so JS keeps the **previous song's** duration and the ratio is nonsense for a moment.
3. **[CONFIRMED] Repeat-one never resets.** The `songChanged` handler is `if (s.currentIndex !== e.index) { … positionMs: 0 }` (`engine.ts:119-140`). In repeat-one ExoPlayer fires `onMediaItemTransition(reason = REPEAT)` **with the same index**, so JS never resets position/duration and never restarts the tracking session — the bar visibly sweeps back at loop point.
4. **[CONFIRMED] A stale 500 ms poll can land after a track change.** `setInterval(…, 500)` (`engine.ts:175`) awaits `getState()`; the reply has **no `songId` check**, so an old position can be written after the switch.
5. **[CONFIRMED] Persisted position is rendered on cold start.** `partialize` includes `positionMs` and `durationMs` (`store/player.ts:152-163`), so the mini player shows a stale time even though nothing is loaded natively.
6. **[CONFIRMED] Seek gate desync.** `seekRequestMs` pauses the poll (`engine.ts:180`) while Kotlin suppresses `seeked` for 500 ms (`VinaraaPlayerPlugin.kt:313-314`, `isSeeking` flag) — rapid consecutive seeks can desync.
7. **[VERIFY] Web fallback differs.** In the browser the web stub drives `audio.currentTime` (`playerWebStub.ts:100-115`); `timeupdate`/`seeked` timing is different from ExoPlayer, so a fix that only passes in the browser is not proof — test on a device.

**Fix**
- **Native emits progress; JS stops polling blindly.** Add a main-thread ticker in `VinaraaPlayerPlugin.kt` (only while playing **and** the WebView is foreground) emitting every 500 ms:
  ```kotlin
  notifyListeners("progress", JSObject().apply {
    put("songId", p.currentMediaItem?.mediaId)
    put("index", p.currentMediaItemIndex)
    put("positionMs", p.currentPosition)
    put("durationMs", if (p.duration == C.TIME_UNSET) -1L else p.duration)
    put("bufferedMs", p.bufferedPosition)
    put("state", p.playbackState)
  })
  ```
- **Always forward the transition reason:** in `onMediaItemTransition` add `put("reason", reason)` (REPEAT = 0, AUTO = 1, SEEK = 2, PLAYLIST_CHANGED = 3) and also emit from `onPositionDiscontinuity(AUTO_TRANSITION)`.
- **`songChanged` must always reset the UI**, even when the index is unchanged:
  ```ts
  VinaraaPlayer.addListener('songChanged', (e) => {
    const s = st.getState();
    const song = s.queue[e.index];
    st.setState({ currentIndex: e.index, isPlaying: e.playWhenReady ?? s.isPlaying });
    progressStore.setState({ positionMs: 0, durationMs: song?.durationMs ?? 0, epoch: progressStore.getState().epoch + 1 });
    if (e.reason === 0 || e.reason === 1) restartTrackingSession(song);   // see A11
  });
  ```
- **Drop stale progress:** in the `progress` listener ignore any event whose `e.songId !== currentSong.id`; when `e.durationMs <= 0` keep the **song's own** `durationMs` (never the previous song's).
- **Split position out of the main store.** New `app/src/store/progress.ts` (zustand; only `positionMs`, `durationMs`, `bufferedMs`, `epoch`). Ticks then re-render only the bars (fixes A12 too).
- **Render the bar with `transform`, and remount per track:**
  ```tsx
  <div key={epoch} className="h-full bg-primary origin-left" style={{ transform: `scaleX(${progress})` }} />
  ```
  no `transition` on it (or `transition: transform 500ms linear` **only** when the epoch is unchanged).
- **Remove `positionMs`/`durationMs` from `partialize`**; on cold start show the saved time as text, then `setQueue({positionMs})` once when the user hits play.
- **Seeking:** drag updates a local `seekValue` only; on release call native `seekTo`, then ignore progress events for 300 ms **by timestamp** (not with a Kotlin boolean flag).

**Acceptance:** (a) repeat-one at the loop point → bar **and** the counter both snap to 0:00 with no sweep-back; (b) tap Next 10× fast → the bar never shows a value belonging to the previous song; (c) kill the app and reopen → the saved time shows, pressing play resumes there with no jump.

**Tasks**
- [ ] A02-1 Native `progress` event (500 ms) with `songId`/`index`/`positionMs`/`durationMs`/`bufferedMs`
- [ ] A02-2 `reason` forwarded from `onMediaItemTransition` + `onPositionDiscontinuity`
- [ ] A02-3 `songChanged` resets position/duration and bumps `epoch` (incl. repeat-one)
- [ ] A02-4 Stale/unknown-song progress events ignored
- [ ] A02-5 `src/store/progress.ts` created; position removed from the player store + persistence
- [ ] A02-6 MiniPlayer bar uses `scaleX` + `key={epoch}`, no width transition
- [ ] A02-7 Seek: local value, timestamp-based ignore window, no Kotlin flag
- [ ] A02-8 Device test: loop × 5, 10× fast Next, cold-start resume

---

## A03 (P0) Player engine architecture — the source of most "random" glitches

All **[CONFIRMED]** in `app/src/player/engine.ts` and `app/src/store/player.ts`.

| # | Problem (with citation) | Fix |
|---|---|---|
| 3.1 | UI Next/Prev mutate `currentIndex` (`store/player.ts:115-145`); the subscriber sees `song.id !== loadedId` (`engine.ts:42`) and **rebuilds the whole native queue** (re-prepare, re-buffer, gap, wrong position). | UI next/prev call `VinaraaPlayer.next()/previous()`; the native `songChanged` event updates the store. `store.nextTrack` becomes a thin native wrapper. |
| 3.2 | The same subscriber also fires on `queue.length` change (`engine.ts:42`), so **every** append (including auto-prefetch, `engine.ts:106-116`) restarts the current song. | Compare a `queueVersion` bumped **only** by `setQueue`). Queue edits go through `insertNext/appendItems/removeAt/moveItem`. |
| 3.3 | **Shuffle is fake:** `store/player.ts:121-127` picks a random index in JS, but ExoPlayer advances sequentially when a song ends naturally. There is no `setShuffle` in the plugin bridge (`app/src/native/player.ts:4-51`). | `p.shuffleModeEnabled = true/false` natively; delete the JS random branch. Notification + auto-advance then agree with the UI. |
| 3.4 | **Prefetch hammering:** block D (`engine.ts:106-116`) runs on **every** store update — and `positionMs` updates twice a second. If the recommendation reply contains only duplicates, nothing is appended, `fetchingMore` is reset in `.finally`, and `/recommendations/next` is called again 500 ms later, forever (also eats the Render free-tier rate limit). | Move prefetch into `songChanged` only; guard with `lastPrefetchedFromId`; 60 s back-off on an empty result; cap the queue at 200 items. |
| 3.5 | **Cold start:** the persisted queue is restored but the native player is empty; pressing ▶ calls `resume()` (`engine.ts:91-97`) → nothing happens. | Keep a `nativeLoaded` flag; on the first play when `!nativeLoaded`, call `setQueue({items, startIndex, positionMs, play:true})` once. |
| 3.6 | **Events dropped in the background:** `activity?.runOnUiThread { notifyListeners(…) }` (`VinaraaPlayerPlugin.kt:37,40,68,76,84,102,113,130,147,336,388`). With the screen off / activity destroyed, `activity` is `null` → no events → stale JS state on return. | Remove the `activity` dependency: post to a main-thread `Handler`. On `appStateChange(isActive)` call `getState()` + `getQueue()` once and **reconcile by `songId`**. |
| 3.7 | **Error loop:** `engine.ts:157-165` waits 1 s then calls `nextTrack()` — with no network it skips song after song forever. | Count consecutive errors; after 3 stop and show "Playback stopped — no connection" + Retry. Distinguish `ERROR_CODE_IO_NETWORK_CONNECTION_FAILED` (offer downloads) from 4xx/5xx. |
| 3.8 | `history: Song[]` (`store/player.ts:26,119,142`) is written but never used for navigation. | Delete it; native previous (restart if > 3 s) is enough. |
| 3.9 | `ended` + `repeat:'all'` → JS `nextTrack()` wraps to index 0 (`engine.ts:143-147,198-201`) and then triggers a rebuild. | Native `REPEAT_MODE_ALL` already wraps; ignore `ended` unless `repeat === 'off'`. |
| 3.10 | Two competing "open player" listeners: `engine.ts:33-35` **and** `App.tsx:85-88` (plus `checkIntent()` at `engine.ts:21-29`). | Keep exactly one (in `App.tsx`). |
| 3.11 | `PlaybackService.kt:30-31` builds `ExoPlayer.Builder(this).build()` with **no** `setHandleAudioBecomingNoisy`, no wake mode, no `LoadControl`, no cache; `release()` sits inside the media-session `run {}` block (lines 57-58) so the player leaks if the session is null. | Apply §B-3 in full. |

**Acceptance:** Next in the mini player continues audio in < 300 ms with no re-buffer of the same song; the notification's next/prev always matches the in-app title; shuffle on + let songs end naturally → random, not sequential; the queue sheet reflects true native order after insert/remove/move.

**Tasks**
- [ ] A03-1 Next/Prev → native only; `songChanged` drives the store
- [ ] A03-2 `queueVersion` rebuild rule (no length-based rebuild)
- [ ] A03-3 Native `setShuffle`; JS random branch deleted
- [ ] A03-4 Prefetch only on `songChanged`; guarded, backed off, queue capped at 200
- [ ] A03-5 `nativeLoaded` cold-start path
- [ ] A03-6 Kotlin events via main `Handler` (no `activity?.`); reconcile on foreground
- [ ] A03-7 Max 3 consecutive errors → stop + Retry toast
- [ ] A03-8 `history` array and the duplicate open-player listener deleted
- [ ] A03-9 `getQueue` reconciliation implemented
- [ ] A03-10 Device test matrix from A03 acceptance

---

## A04 (P0) Bottom nav + mini player disappear after hardware Back from the player

**Where:** `app/src/App.tsx:89-99` (back listener), `app/src/store/player.ts` (`showPlayer`), `app/src/components/BottomNav.tsx:20` (`if (showPlayer) return null`), `app/src/components/MiniPlayer.tsx:14` (`if (!song || showPlayer) return null`), `app/src/navigation/Navigator.tsx:31,60-61`.

**Root cause [CONFIRMED]** — `showPlayer` is set `true` when the player opens but is reset to `false` only by the on-screen close button or the drag-down (`FullPlayer.tsx:232,254`). Hardware Back calls `window.history.back()` (`App.tsx:97`) and never resets it, so the flag stays `true` and the nav + mini player remain hidden on every later screen — most visibly Album / Playlist / Artist.

**Fix** — derive it from the route, not from a flag:
```tsx
const isPlayerRoute = useLocation().pathname.startsWith('/player');
```
Delete `showPlayer`/`setShowPlayer` from the store (or keep it as a one-way mirror: `useEffect(() => setShowPlayer(isPlayerRoute), [isPlayerRoute])`). Make `backButton` smart, in this order:
1. a bottom sheet / queue / action sheet is open → close it;
2. on `/player` → `navigate(-1)`;
3. on a main tab that is not Home → go to the Home tab instead of exiting;
4. on Home → `App.minimizeApp()`.

**Acceptance:** open the player → hardware Back → nav + mini player are back. With a sheet open, Back closes only the sheet.

**Tasks**
- [ ] A04-1 `showPlayer` derived from the route (single source of truth)
- [ ] A04-2 4-step back-handler order implemented
- [ ] A04-3 Sheets register themselves so Back can close them
- [ ] A04-4 Nav + mini player verified on album / playlist / artist / profile / settings / downloads

---

## A05 (P0) `App.tsx` side-effects re-run on every navigation

**Where:** `app/src/App.tsx:79-101`.

**Root cause [CONFIRMED]** — the `useEffect` depends on `[location, navigate]`, so on **every** route change it calls `setupOneSignal()` again (re-initialise, re-ask for notification permission, duplicate `pushSubscription` listeners, repeated `registerDevice`) and re-registers the `backButton` listener; the cleanup removes it asynchronously through a promise (`listener.then(l => l.remove())`) which races and can leave **two** handlers installed. The OneSignal App ID is also hard-coded (`App.tsx:31`).

**Fix**
```tsx
useEffect(() => { startPlayerEngine(); setupOneSignalOnce(); }, []);   // once
const pathRef = useRef(location.pathname); pathRef.current = location.pathname;
useEffect(() => {                                                       // once, reads pathRef
  const sub = CapacitorApp.addListener('backButton', () => handleBack(pathRef.current));
  return () => { sub.then(l => l.remove()); };
}, []);
```
`setupOneSignalOnce` uses a module-level `let done = false`; the App ID moves to `import.meta.env.VITE_ONESIGNAL_APP_ID`; notification permission is requested **in context** (after the first successful login/onboarding or the first like/download, Android 13+), not at cold start.

**Tasks**
- [ ] A05-1 Effects split (once vs per-route)
- [ ] A05-2 `setupOneSignalOnce` idempotent; App ID in env
- [ ] A05-3 Exactly one `backButton` listener; verified with a log counter
- [ ] A05-4 Permission prompt moved to a contextual moment with a pre-prompt sheet

---

## A06 (P0) Downloads don't work

**Where:** `app/src/components/SongActionSheet.tsx:39-66`, `app/src/screens/FullPlayer.tsx:169-186`, `app/android/app/src/main/java/com/music/vinaraa/VinaraaPlayerPlugin.kt:383-402`, `app/src/utils/offline.ts:1-41`, `app/src/screens/Library.tsx:93-160`, `app/android/app/src/main/AndroidManifest.xml:54-56`, `app/src/navigation/Navigator.tsx` (no `/downloads` route), `app/src/screens/Offline.tsx:25`.

**Root cause — seven separate faults, all [CONFIRMED]**
1. **Marked "downloaded" the moment it is enqueued.** `SongActionSheet.tsx:47-60` and `FullPlayer.tsx:175-183` call `VinaraaPlayer.download(...)` and then **immediately** `saveDownloadedSong(...)`, even though the plugin only returns `downloadId` (`VinaraaPlayerPlugin.kt:383-402`).
2. **`localPath` is never stored** (`utils/offline.ts:26-37`), so an offline play still uses the **remote** `streamUrl` → fails with no network.
3. **File name destroys non-Latin titles.** `song.name.replace(/[^a-zA-Z0-9.\-_ \(\)]/g, '')` (`SongActionSheet.tsx:46`, `FullPlayer.tsx:172`) strips **every Telugu/Hindi character** → `.mp3` or empty names → collisions and `DownloadManager` failures.
4. **`DownloadManager` into public Music is the wrong mechanism.** `VinaraaPlayerPlugin.kt:390-399`: public `DIRECTORY_MUSIC`, no `Authorization` header (so a `/music/stream/:id` URL can never be used), no progress callback, no `localPath` returned, and files in public Music are not reliably readable by ExoPlayer on API 29+ without MediaStore.
5. **Runtime permissions are never requested while minSdk is 24** (`variables.gradle:2`), yet the manifest still declares `WRITE_EXTERNAL_STORAGE`/`READ_EXTERNAL_STORAGE`/`READ_MEDIA_AUDIO` (`AndroidManifest.xml:54-56`). On API 24-28 the download **silently fails**. (Play Store also flags these.)
6. **Downloads list is a JSON blob in `Preferences`** (`utils/offline.ts:16-24`) — size limits, no migration, no integrity check, no reconciliation with the filesystem.
7. **`/downloads` does not exist.** `Offline.tsx:25` navigates to `/downloads`; the route table in `Navigator.tsx:37-58` has no such path → `NotFound`.

**Fix — a real download system**
- **Native: `WorkManager` + OkHttp** (`DownloadWorker.kt`), saving to app-specific storage `context.getExternalFilesDir("music")/{songId}.m4a` (no permission, removed on uninstall, readable by ExoPlayer via `file://`).
- **URL handling:** accept either an absolute CDN URL or a song id; when it is an id, resolve through the backend, but **prefer the direct CDN URL** so Render's bandwidth is untouched (§A15). Add the `Authorization: Bearer <token>` header only for backend URLs.
- Write to `{id}.m4a.part`, rename on success, verify `length > 0` (and `Content-Length` when present); resume with `Range` if the `.part` exists.
- Emit `downloadProgress { songId, status: queued|downloading|done|failed|cancelled, progress 0..1, bytes, localPath?, error? }`.
- Methods: `downloadStart`, `downloadCancel`, `downloadDelete`, `downloadList()` (reconciles files that actually exist), `storageInfo()`.
- Max 2 concurrent; "Wi-Fi only" via `NetworkType.UNMETERED`; foreground notification with progress (`FOREGROUND_SERVICE_DATA_SYNC` permission); also cache cover art to `files/art/{songId}.jpg`.
- **JS:** new `src/store/downloads.ts` (zustand + `idb`) with the states above; reconcile with `downloadList()` on start; `ensurePlayable` prefers `localPath` and `toNativeItem` sends `uri: 'file://…'`; offline playback plays local files only.
- Replace the action-sheet row with a **stateful `DownloadButton`**: ⬇ → ring % → ✓ (tap = remove with confirm) → ⟳ retry. Add **"Download all"** to album/playlist headers with "3 of 12".
- Settings → Downloads: quality, Wi-Fi only, storage used, "Delete all downloads".

**Acceptance:** download a Telugu-titled song, enable airplane mode, restart → the app opens on Downloads and the song plays with artwork. Kill the network mid-download → status ⟳ Failed, retry works. Notification shows progress.

**Tasks**
- [ ] A06-1 `DownloadWorker.kt` (WorkManager + OkHttp) → app-specific storage, `.part` + rename + verify
- [ ] A06-2 `Authorization` header support; direct-CDN preference documented
- [ ] A06-3 `downloadProgress` events + 5 plugin methods + `storageInfo`
- [ ] A06-4 Foreground notification; `FOREGROUND_SERVICE_DATA_SYNC` added; storage permissions removed
- [ ] A06-5 Cover art cached for offline cards
- [ ] A06-6 `src/store/downloads.ts` (idb) + startup reconciliation
- [ ] A06-7 `ensurePlayable` prefers the local file; offline queue plays local only
- [ ] A06-8 Stateful `DownloadButton` in rows, sheet, album/playlist header
- [ ] A06-9 `/downloads` route created; `Offline.tsx` target fixed
- [ ] A06-10 Old `Preferences` blob migrated/deleted
- [ ] A06-11 Settings → Downloads section
- [ ] A06-12 Airplane-mode test passed (Telugu title)

---

## A07 (P0) Offline-first start: "no internet → Downloads, else Home"

**Where:** `app/src/utils/offline.ts:43-45`, `app/src/screens/Splash.tsx:9-23`, `app/src/screens/Library.tsx:159`, `app/src/screens/Offline.tsx:25`, `app/src/native/player.ts:8` (native `isOnline` exists but is never called), `app/package.json:14-18` (**no `@capacitor/network`**).

**Root cause [CONFIRMED]** — `isOnline()` is `navigator.onLine`, which is unreliable inside a WebView; the native `isOnline` (which uses `NET_CAPABILITY_VALIDATED`, `VinaraaPlayerPlugin.kt`) is never called; `Splash` always routes to `/home` or `/login` based only on `isAuthenticated`; `Library` reads `navigator.onLine` once at mount; `Offline.tsx` points at a route that doesn't exist.

**Fix**
1. `npm i @capacitor/network`. New `src/net/useNetwork.ts` (zustand): `{ online, type, serverState }`, seeded from `Network.getStatus()` and kept live with `Network.addListener('networkStatusChange')`.
2. Add `serverState: 'ok' | 'waking' | 'down'`. The backend is on Render **free**, so cold starts take 30-60 s: ping `GET /health` with a 4 s timeout — a timeout is **not** offline → banner "Server is waking up… this can take up to a minute", never "No internet".
3. Boot flow in `Splash` (no artificial delay):
   ```
   token = nativeToken()
   if (!token)          → /welcome
   else if (net.online) → /home
   else                 → /downloads   (replace)
   ```
   While offline, `checkAuth` must trust the stored token and **never log out** on network errors.
4. New full-screen **`/downloads`** route (offline home).
5. Global `OfflineBanner` (28 px, slides from the top). In the bottom nav, Search/Stats go to 40 % opacity with a tiny wifi-off glyph; tapping shows "Needs internet" instead of navigating. Home/Library/Downloads stay usable (React Query persisted cache, or an empty state with a **"Go to Downloads"** button).
6. When the network returns: toast "Back online" + a **"Refresh"** action — never auto-navigate while music is playing.
7. On **Android**, keep the native `isOnline` as a secondary check for captive portals.

**Acceptance:** airplane mode → cold start → lands on Downloads in < 1 s; turn Wi-Fi on → toast; Home loads on tap.

**Tasks**
- [ ] A07-1 `@capacitor/network` installed; `useNetwork` store live
- [ ] A07-2 `/health` probe with a 4 s timeout + `serverState` + waking banner
- [ ] A07-3 Boot routing implemented exactly as above
- [ ] A07-4 `/downloads` route + offline layout
- [ ] A07-5 `OfflineBanner` + dimmed nav items + "Needs internet" toasts
- [ ] A07-6 "Back online" toast with Refresh, no auto-navigation
- [ ] A07-7 Native `isOnline` used as a secondary check
- [ ] A07-8 Test: airplane cold start, Wi-Fi return, captive portal (hotel Wi-Fi)

---

## A08 (P0) Launch shows the app icon for 1-2 s on newer Android, a direct splash on older

**Where:** `app/android/app/src/main/AndroidManifest.xml:6,8,16`, `app/android/app/src/main/res/values/styles.xml` (`AppTheme.NoActionBarLaunch`), `app/android/app/src/main/java/com/music/vinaraa/MainActivity.kt:5-22`, `app/capacitor.config.ts` (`SplashScreen` block), `app/src/screens/Splash.tsx:13-14`, `app/index.html`.

**Root cause [CONFIRMED]**
1. **Android 12+ always uses the system splash = the launcher icon on a coloured circle.** Your `AppTheme.NoActionBarLaunch` parents `Theme.SplashScreen` but defines **only** `windowSplashScreenBackground` (#090714) — there is **no** `windowSplashScreenAnimatedIcon`, no `windowSplashScreenIconBackgroundColor`, no `postSplashScreenTheme`; `MainActivity` never calls `installSplashScreen()`.
2. **The manifest ignores the adaptive icon that already exists.** `res/mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml` are present and correct, but the manifest points to `android:icon="@drawable/vinaraa"` / `android:roundIcon="@drawable/vinaraa"` — a plain PNG (`res/drawable/vinaraa.png`) that Android masks and pads.
3. Android ≤ 11 ignores all of that and just paints `windowBackground` / `splash.png` → looks like your custom splash. Hence "icon then splash" on new devices, "direct splash" on old ones.
4. `capacitor.config.ts` configures the `SplashScreen` plugin, but **`@capacitor/splash-screen` is not installed** (`package.json:14-18`) → those options do nothing.
5. On top of that the web splash adds a **fake 1200 ms delay** (`Splash.tsx:13-14`) and then animates → the user sees three visuals: system splash → blank WebView → web splash.
6. `index.html` has `<title>app</title>`, no `theme-color`, no inline background → possible white frame before the CSS bundle loads.

**Fix (exact)**
1. **Assets:** repoint the manifest to `@mipmap/ic_launcher` / `@mipmap/ic_launcher_round` (drop `@drawable/vinaraa`); add a `<monochrome>` layer for Android 13 themed icons; verify the foreground "V" sits inside the 66 dp safe zone of the 108 dp canvas. Create `res/drawable/ic_splash_logo.xml` (or a 288×288 dp PNG) of the "V" mark **centred inside the inner 192 dp circle** — anything outside is clipped on Android 12+.
2. `res/values/colors.xml`: `vinaraa_bg = #0B0A1A`; `res/values-night/colors.xml`: `vinaraa_bg = #0B0A1A` (same, so the splash never flashes white in light mode).
3. `res/values/styles.xml`:
   ```xml
   <style name="AppTheme.Splash" parent="Theme.SplashScreen">
       <item name="windowSplashScreenBackground">@color/vinaraa_bg</item>
       <item name="windowSplashScreenAnimatedIcon">@drawable/ic_splash_logo</item>
       <item name="windowSplashScreenIconBackgroundColor">@color/vinaraa_bg</item>
       <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
   </style>
   ```
   and set `android:theme="@style/AppTheme.Splash"` on the `<activity>`.
4. `MainActivity.kt`:
   ```kotlin
   override fun onCreate(savedInstanceState: Bundle?) {
       val splash = installSplashScreen()          // BEFORE super.onCreate
       registerPlugin(VinaraaPlayerPlugin::class.java)
       super.onCreate(savedInstanceState)
       var keep = true
       splash.setKeepOnScreenCondition { keep }
       Handler(Looper.getMainLooper()).postDelayed({ keep = false }, 2500)  // safety net
       VinaraaPlayerPlugin.onAppReady = { keep = false }                    // JS calls appReady()
   }
   ```
   Call `appReady()` from `main.tsx` after the first `requestAnimationFrame` following `root.render`.
5. `index.html`: `viewport-fit=cover`, `<meta name="theme-color">` for both schemes, real `<title>Vinaraa</title>`, and an **inline** `<style>html,body,#root{background:#0B0A1A}</style>`.
6. **Web splash:** delete the artificial delay (`Splash.tsx:13-14`); the first frame must be pixel-identical to the native splash (same mark, same centre, same background), then cross-fade/expand into the first screen as soon as auth + network resolve (target < 400 ms after WebView ready). Show the equalizer bars **only** if resolution takes > 600 ms.
7. Delete the `SplashScreen` block from `capacitor.config.ts` (the AndroidX splash above is sufficient) — or install `@capacitor/splash-screen` properly. Do not half-configure it.
8. Test on Android 8, 11, 12, 13, 14, 15: one identical splash, no icon-in-circle flash, no white frame.

**Tasks**
- [ ] A08-1 Adaptive + monochrome launcher icon wired in the manifest; `@drawable/vinaraa` removed from `icon`/`roundIcon`
- [ ] A08-2 `ic_splash_logo` inside the 192 dp safe zone
- [ ] A08-3 `AppTheme.Splash` with animated icon + `postSplashScreenTheme`
- [ ] A08-4 `installSplashScreen()` + `setKeepOnScreenCondition` + `appReady()` from JS
- [ ] A08-5 `values` / `values-night` colours
- [ ] A08-6 `capacitor.config.ts` SplashScreen block resolved
- [ ] A08-7 `index.html` meta + inline background + no-flash theme script
- [ ] A08-8 Web splash: no fake delay, identical first frame, cross-fade out
- [ ] A08-9 Tested on Android 8 / 11 / 12 / 13 / 14 / 15

---

## A09 (P0/P1) Smaller confirmed bugs

| ID | File:line | Problem | Fix |
|---|---|---|---|
| 9.1 | `screens/Search.tsx:227`, `screens/Artist.tsx:104`, `screens/Stats.tsx:148` **and** `navigation/Navigator.tsx:60` | `<MiniPlayer/>` is rendered twice on those screens (stacked duplicates). | Remove it from the screens; only `Navigator`/`AppShell` renders it. |
| 9.2 | `navigation/Navigator.tsx:34`, `motion.ts` (`durations.page = 0.42`, exit 0.42 + enter 0.42) | `AnimatePresence mode="wait"` → **~0.85 s** before a page appears; screens with no motion root get no exit animation at all. | Replace the routing animation entirely (§C-5.2). Never use `mode="wait"` for tabs. |
| 9.3 | `index.css` `.pb-safe { padding-bottom: calc(env(safe-area-inset-bottom) + 80px); }` | The real chrome is mini player (72 px offset + card) + nav (~64 px) → the last list items hide underneath. | Introduce `--bottom-chrome` (nav + mini player + safe area) and use `padding-bottom: calc(var(--bottom-chrome) + 16px)` on scroll containers. |
| 9.4 | `screens/Home.tsx:56` | `shadow-[0_0_20px_rgba(var(--color-primary),0.5)]` — `--color-primary` is not defined in `index.css` (the vars are `--primary` etc.), so the rule is invalid and **no glow renders**. | Use the `shadow-glow` token (§C-2). |
| 9.5 | `screens/Home.tsx:173-175` | A 5-minute `setInterval(loadData)` keeps polling while the app is backgrounded, and each call re-renders the whole feed. | React Query with `staleTime` + `refetchOnReconnect`; refresh on pull-to-refresh only. |
| 9.6 | `screens/Settings.tsx:21,45,56-58` | `setQuality(v); savePrefs();` → `savePrefs` closes over the **previous** state and saves the old value; nothing is ever loaded from `users.me().preferences`; all settings are local `useState`. | Load preferences via React Query; optimistic `updatePreferences({ audioQuality })` with the **new** value; persist theme locally. |
| 9.7 | `screens/PlaylistPage.tsx:11` | `const { id } = { id: window.location.pathname.split('/').pop() }` instead of `useParams`. | Use `useParams`; rewrite the editorial-fallback chain as one `useQuery`. |
| 9.8 | `components/SongActionSheet.tsx:68-75` | Share uses `window.location.href` (a Capacitor localhost URL) and silently does nothing if `navigator.share` is missing. | Install `@capacitor/share`; share `title + artist` + a real Saavn/deep link. |
| 9.9 | `VinaraaPlayerPlugin.kt:186-203`, `store/auth.ts:20` | Token in plain `SharedPreferences`; `refreshToken: ''` written and later read (see N-01). | `EncryptedSharedPreferences` (androidx.security-crypto); remove all refresh-token keys. |
| 9.10 | `api/client.ts:76-89` | Retry only on `'Failed to fetch'` with 1 s/2 s; no timeout, no `AbortController`, no in-flight dedupe → a Render cold start (30-60 s) shows errors. | 20 s timeout via `AbortController`, ≤ 3 retries with back-off for GET only, dedupe identical in-flight GETs, surface `serverState:'waking'`. |
| 9.11 | `utils/offline.ts:43` | `isOnline()` = `navigator.onLine`. | Delete; use `useNetwork` (A07). |
| 9.12 | `capacitor.config.ts` | `CapacitorHttp.enabled: true` (patches `fetch`; can break abort/streaming); no `server.androidScheme`, no `android.allowMixedContent`. | Remove `CapacitorHttp`, add `server: { androidScheme: 'https' }` and `android: { allowMixedContent: false }` (see V-06). |
| 9.13 | `AndroidManifest.xml:5,12-18,37-44` | `allowBackup="true"` (backs up the JWT); no `windowSoftInputMode="adjustResize"` (keyboard covers login fields); no `enableOnBackInvokedCallback` (no predictive back); no `networkSecurityConfig`; service `exported="true"` (required for Media3 system UI — keep, but document it). | `allowBackup="false"` (or exclude the token via `dataExtractionRules`), `adjustResize`, `enableOnBackInvokedCallback="true"`, cleartext disabled + `networkSecurityConfig`. |
| 9.14 | **REMOVED** — the old file's "dead `ACTION_NEXT/PREVIOUS` receiver" | Not present in the code; `PlaybackService.kt` holds only the player builder/`release`, and the plugin's `MediaController.Callback` is live. | Do nothing. Do **not** delete the controller callback. |
| 9.15 | `index.css` (`@layer base`) | Global `scrollbar-width: none !important`, `overflow: hidden !important` on html/body/#root, `user-select: none` on body, `touch-action: pan-y` on body → breaks horizontal rails/swipes and text selection in lyrics/inputs, hides scroll feedback. | Keep overflow hidden on html/body; scope `touch-action` per component (rails `pan-x`, sheets `none`); re-enable selection for lyrics, error text and inputs. |
| 9.16 | `screens/Offline.tsx:12` (`h-screen`), `Splash.tsx` | `100vh` is wrong in an edge-to-edge Android WebView. | `h-dvh` / `100dvh`. |
| 9.17 | `store/player.ts:115-145` | `nextTrack()` sets `isPlaying: true` even when playback was paused, and `previousTrack()` seeks to 0 when `positionMs > 3000` **in JS** while native has its own rule → double behaviour. | Delegate both to native (§A03.1). |

**Tasks**
- [ ] A09-1 … A09-17 each applied and re-verified (one commit per row)

---

## A10 (P0) Remove refresh tokens from the **entire** project — one non-expiring access token

**Owner requirement:** no refresh token anywhere; one access token that never expires until the user logs out or changes/resets the password.

**The real reason "music works but playlists / account / stats / tracking fail" [CONFIRMED]**
- Routes under `/music/*` use `optionalAuth` (`soundwave-backend/src/routes/*.js → middleware/auth.js:47-57`); when a token is present but rejected it is swallowed (`catch { /* treat as anonymous */ }`) → music keeps working.
- `/users`, `/playlists`, `/stats`, `/tracking`, `/recommendations`, `/onboarding`, `/notifications` use `authenticate` (`middleware/auth.js:11-45`) → **401** with `TOKEN_EXPIRED` / `TOKEN_INVALID` / `SESSION_REVOKED` / `USER_NOT_FOUND`.
- The app's recovery path is **structurally dead**: `client.ts:118` only attempts a refresh for `TOKEN_EXPIRED`, and `client.ts:35-41` returns `null` immediately because `refreshToken` is `''` (written by `store/auth.ts:20`). Result: the 401 is rethrown, no logout happens (`client.ts:134` only matches `SESSION_REVOKED`/`REFRESH_INVALID`), so the app stays "logged in" with a dead token — exactly your "it keeps me logout and logina again to see stats" behaviour.

**Diagnostic first (5 minutes, no code):**
1. Decode the stored JWT on jwt.io → read `exp`, `iat`, `tv`.
2. Call `GET /api/v1/users/me` with it and read `error.code`:

| `error.code` | Meaning | Action |
|---|---|---|
| `TOKEN_EXPIRED` | TTL too short (or `ACCESS_TOKEN_TTL` set in the Render dashboard) | remove the env var + apply the backend change below, re-login once |
| `TOKEN_INVALID` | `JWT_ACCESS_SECRET` changed (blueprint re-sync regenerates it — `render.yaml` uses `generateValue: true`) | set a **fixed** secret in Render and never regenerate it |
| `SESSION_REVOKED` | `tv` mismatch (after password change) | expected once; the app must say "Please sign in again" |
| `USER_NOT_FOUND` | DB reset / user deleted | re-register |
| 200 OK | the server is fine | the problem is client-side (N-01/N-02/N-03) |

### Backend changes (`soundwave-backend`)
- [x] A10-B1 `services/tokenService.js`: **delete** `expiresIn` from `signAccessToken` (lines 13-24). A JWT without `exp` never expires:
  ```js
  function signAccessToken(user) {
    return jwt.sign(                                   // NO expiresIn → no "exp" claim
      { sub: String(user._id), email: user.email, role: user.role, tv: user.security?.tokenVersion || 0 },
      env.JWT_ACCESS_SECRET,
      { issuer: ISSUER, audience: AUDIENCE, algorithm: 'HS256' }
    );
  }
  const issueToken = (user) => ({ accessToken: signAccessToken(user), tokenType: 'Bearer', expiresIn: null });
  ```
- [x] A10-B2 Delete `rotate` (60-86), `issueTokenPair` (36-57), `revokeAllForUser` (89-95), `revokeDevice` (96-103), `listActiveSessions` (~106) and `hashToken`, plus the `RefreshToken` require (line 8).
- [x] A10-B3 `services/authService.js`: `register()`/`login()` return `{ user, tokens: { accessToken, tokenType } }` (keep the `tokens.accessToken` shape so the app keeps working); remove the `revokeAllForUser` calls in `changePassword`/`resetPassword` (lines 120-122, 148-150); rewrite `sessions()` (154) to return `devices` from the user document.
- [x] A10-B4 `routes/auth.routes.js`: delete `POST /auth/refresh` (35-46); `POST /auth/logout` becomes a no-op `ok(res, { loggedOut: true })`; `DELETE /auth/sessions/:deviceId` only `$pull`s the device record (99-100).
- [x] A10-B5 **Delete** `models/RefreshToken.js`; `grep -rn "RefreshToken"` and clear every import; add `scripts/drop-refresh-tokens.js` → `db.collection('refreshtokens').drop()`.
- [x] A10-B6 `config/env.js`: remove `JWT_REFRESH_SECRET` (lines 12, 28), `REFRESH_TOKEN_TTL_DAYS` (30), `ACCESS_TOKEN_TTL` (29). In production **refuse to boot** if `JWT_ACCESS_SECRET` is missing or equals the dev default.
- [x] A10-B7 `middleware/auth.js`: drop the `TOKEN_EXPIRED` branch (20-21); keep the `tv` check (35-36) **only** for password change/reset; remove the `tv` bump from `logout-all` unless you deliberately want "log out everywhere"; in `optionalAuth` (47-57) add `res.set('X-Auth-State', 'invalid')` when a token was present but rejected (keep treating it as anonymous).
- [x] A10-B8 `render.yaml`: remove `JWT_REFRESH_SECRET`; change `JWT_ACCESS_SECRET` from `generateValue: true` to a value the owner copies once and never regenerates; add a comment that any regeneration invalidates every existing token. Delete `ACCESS_TOKEN_TTL` from the Render dashboard.
- [x] A10-B9 Update `routes/index.js:136-146` (endpoint list), `README.md` and `postman/SoundWave.postman_collection.json`.
- [x] A10-B10 README: "tokens never expire; revoke everyone by changing your password".

### App changes (`app/`)
- [x] A10-A1 `api/client.ts`: delete `refreshPromise`, `refreshAccessToken()` and the `/auth/refresh` call (18-73), the `TOKEN_EXPIRED` branch (118-124), and the `mockRefreshToken`/`refreshToken` handling in `getTokens()`; the function returns `{ token }` only.
- [x] A10-A2 New 401 rule: `TOKEN_INVALID | SESSION_REVOKED | USER_NOT_FOUND` → call `useAuthStore.getState().logout({ reason })` **once** (debounced), go to `/login`, toast "Your session ended. Please sign in again."; a response carrying `X-Auth-State: invalid` is treated the same.
- [x] A10-A3 **Never log out** on network errors, timeouts, 5xx or 429.
- [x] A10-A4 `store/auth.ts`: `setAuth({ accessToken })` only — drop the `refreshToken: ''` argument in `login` (line 20) and `logout` (line 32).
- [x] A10-A5 `native/player.ts:10-12` (`setAuth`, `getAccessToken`), `native/playerWebStub.ts` and `VinaraaPlayerPlugin.kt:186-203`: remove the `refresh_token` prefs key and the `refreshToken` field.
- [x] A10-A6 `store/auth.ts → checkAuth()`: when online, validate once with `users.me()` (3 s timeout) — 200 → refresh the stored user; invalid-token codes → logout; network failure → **stay logged in** (offline mode).
- [x] A10-A7 Persist the token in `EncryptedSharedPreferences` instead of plain `SharedPreferences`, and set `android:allowBackup="false"`.
- [x] A10-A8 `grep -rni "refresh" app/src app/android` returns **no** token-related hits (unrelated names like `refetchOnReconnect` stay).
- [ ] A10-A9 Add a device list + "Log out of all devices" in Settings → Account (uses `tv`).

**Acceptance:** log in, change nothing, close and reopen the app; set the device date forward 400 days and reopen → Stats, Playlists, Profile and Tracking all still work with no re-login. `POST /auth/refresh` → 404. Changing the password logs out every device with a clear message.

> **Security caveat (short, honest):** a never-expiring bearer token means a leaked token is valid forever. The mitigations are exactly the tasks above — `EncryptedSharedPreferences` + `allowBackup="false"` (so `adb backup` / Drive backup cannot extract it), HTTPS only (`androidScheme: 'https'`, cleartext disabled), a device list with "log out everywhere", `tokenVersion` bumped on password change, and an admin-only way to rotate `JWT_ACCESS_SECRET` (which invalidates everything). If you ever want a middle ground, `ACCESS_TOKEN_TTL: '400d'` + `refetchOnReconnect` gives the same user-visible behaviour with a bounded blast radius — say the word and I will swap it in.

---

## A11 (P0) Stats tab empty / forces re-login / listening not tracked

**Where:** `screens/Stats.tsx:31-36,137-140`, `player/engine.ts:12,47-62,119-141,187-193`, `screens/FullPlayer.tsx:41-72`, `api/endpoints.ts:125-134`, `soundwave-backend/src/services/trackingService.js`, `soundwave-backend/src/models/ListeningSession.js:81-86`.

**Root cause**
1. **[CONFIRMED] The app hides the error.** `Stats.tsx:36`: `.catch(() => setLoading(false))` and then the `!dashboard` branch renders "Listen to songs to see your stats" (137-140) — a 401 looks like "no data yet", which is why logging out/in "fixes" it.
2. **[CONFIRMED] Double tracking sessions.** `engine.ts:58` starts a session on every song change **and** `FullPlayer.tsx:54` starts another, with its own 12 s heartbeat (68-72) and `endSession` cleanup (61-63). Two sessions per song; the engine's one is never ended on the last song.
3. **[CONFIRMED] Heartbeats stop when the screen is off.** They are driven by JS timers (`engine.ts:175-195` 500 ms poll, `FullPlayer.tsx:68` 12 s). Android throttles WebView timers in the background → screen-off listening is **never recorded**, and the server credits time only from heartbeats (`trackingService.heartbeat`).
4. **[CONFIRMED] Position-based heartbeat gate.** `engine.ts:187`: `if (currentSessionId && n.positionMs - lastHeartbeatMs >= 10000)`. After a seek back, a loop or a restart `positionMs < lastHeartbeatMs` → **no heartbeats until the playhead passes the old value**.
5. **[CONFIRMED] No heartbeat on pause/resume/seek/end**, and `endSession` runs only when `oldPosition > 0` (`engine.ts:47`).
6. **[CONFIRMED] Silent failures.** Every tracking call ends in `.catch(() => {})` (`engine.ts:50,62,192`, `FullPlayer.tsx:54,61,69`): a failed `startSession` (cold server / dead token) means no session id for the whole song, never retried.
7. **[CONFIRMED] No offline tracking** although `POST /tracking/sync` exists (`endpoints.ts:134`) and is never called.
8. **[CONFIRMED] No context.** `tracking.startSession(songId)` sends only the song id (`endpoints.ts:126-127`) — no `source`, `contextId` or `deviceId`, although the model and service support them (`PlayEvent.js:47-48`, `ListeningSession.js:60-61`) and `utils/device.ts` already generates a device id.

**Fix — move tracking into native Kotlin (it keeps running while the WebView sleeps)**
- [ ] A11-1 New `TrackingClient.kt` (OkHttp, token from prefs, base URL + deviceId passed once from JS via `setConfig({apiBase, deviceId})`).
- [ ] A11-2 Attach a `Player.Listener` in **`PlaybackService`** (not the plugin, so it survives a dead Activity):
  - `onMediaItemTransition` → end the previous session (using the old position) → start a new one with `{songId, deviceId, source, contextId}`;
  - `onIsPlayingChanged` → immediate heartbeat `state: playing|paused`;
  - a 12 s ticker **while playing** → heartbeat `{positionMs, state, clientTimestamp, bufferedMs}`;
  - `onPositionDiscontinuity(SEEK)` → heartbeat immediately (the server detects seeks itself);
  - `STATE_ENDED` / service destroyed → heartbeat `state:'ended'` then end;
  - on network failure → append to `files/tracking_queue.jsonl` and flush with `POST /tracking/sync` (≤ 200 sessions) when connectivity is validated, marked `source:'offline'`;
  - retry `startSession` ≤ 3× with back-off; if it still fails, buffer the session locally and send it later.
- [ ] A11-3 JS: `VinaraaPlayer.setPlaybackContext({ source, contextId })` called by Album/Playlist/Search/Home/Artist/Library whenever they enqueue.
- [ ] A11-4 **Delete** every `tracking.*` call from `engine.ts` and `FullPlayer.tsx` (sessionId state, the 12 s heartbeat effect, the `endSession` cleanup). Keep `endpoints.ts → tracking` only as a web fallback.
- [ ] A11-5 `Stats.tsx`: 4 explicit states — skeleton · **error with "Couldn't load your stats · Retry"** · true empty (`overview.plays === 0` → "Play a few songs and your stats will appear here" + "Go to Home") · data. Refetch on tab focus and on the `online` event; React Query with `staleTime: 60 s`; pull-to-refresh.
- [ ] A11-6 Settings → About: hidden debug line (tap the version 7×) showing "session … · last heartbeat … · queued N".
- [ ] A11-7 Reduce the double-count: the server already credits `advance = positionMs − lastPositionMs` with caps (`ListeningSession.js:81-86`); after native tracking there is exactly one session per play.

**Acceptance:** play 3 songs with the screen off for 2 minutes → Stats shows "Songs played = 3" and ≈ 2 min of listening time; play offline then reconnect → numbers appear within 30 s; Stats never needs a re-login.

---

## A12 (P1) The whole app re-renders every 500 ms

**Where:** `components/MiniPlayer.tsx:9`, `components/BottomNav.tsx:19-20`, `screens/FullPlayer.tsx:26-30`, `components/QueueSheet.tsx`, `player/engine.ts:175-195`.

**Root cause [CONFIRMED]** — `usePlayerStore()` is called **without a selector**, and `positionMs` is written to that same store twice a second, so every subscribed component re-renders 2×/s (and `BottomNav` re-renders just because it destructures `showPlayer`).

**Fix**: always select (`usePlayerStore(s => s.isPlaying)`; `useShallow` for several fields); move `positionMs/durationMs/bufferedMs` into `store/progress.ts` so only the bars subscribe; `React.memo` on `SongRow`, cards, `ArtistCircle`; each row subscribes only to `isCurrent` and `isPlaying`; lists > 30 items → `@tanstack/react-virtual` (already installed, **unused** — grep is empty) or `content-visibility: auto`.

**Tasks**
- [ ] A12-1 Selectors everywhere; `useShallow` where needed
- [ ] A12-2 `store/progress.ts` wired; no component outside the bars subscribes to position
- [ ] A12-3 `React.memo` + per-row subscriptions
- [ ] A12-4 Virtualisation on long lists
- [ ] A12-5 Measured: React DevTools profiler shows no per-tick renders on Home/Nav when idle

---

## A13 (P0) Bottom navbar missing on Album / Playlist / Artist (and shown where it shouldn't be)

**Where:** `navigation/Navigator.tsx:31,37-61`, `components/BottomNav.tsx:20`, `store/ui.ts:4-9`, `screens/Search.tsx:82-90`, `screens/Home.tsx:182-184`.

**Root cause [CONFIRMED]**
- `showNav = !pathname.startsWith('/player')` → the nav **is** rendered on Splash, Welcome, Login, Register, Forgot/Reset, Onboarding (wrong), and it disappears whenever the stuck `showPlayer` flag is `true` (A04) — which is exactly the Album/Artist/Playlist case.
- `activeTab` is local UI state set only on tap (`ui.ts:5-6`, `BottomNav.tsx` `handleTab`) → after Back or a deep link the wrong tab is highlighted, and detail pages highlight nothing.
- Detail screens push `/player` per song (`Search.tsx:90`, `Home.tsx:184`), which makes "where am I" ambiguous and feeds the back-stack confusion.

**Fix — one route table with chrome metadata: `app/src/navigation/routes.ts`**

| Route | Group | Bottom nav | Mini player | Highlighted tab |
|---|---|---|---|---|
| `/` | boot | no | no | – |
| `/welcome`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/onboarding` | auth | **no** | no | – |
| `/home`, `/search`, `/library`, `/stats` | tab | **yes** | yes | itself |
| `/album/:id`, `/artist/:id`, `/playlist/:id` | detail | **yes** | yes | the tab it came from (`location.state.from`, default Home) |
| `/profile`, `/settings`, `/downloads` | detail | **yes** | yes | Home / Library |
| `/player`, `/player/:id` | player | no | no | – |
| `/offline`, `*` | utility | yes | yes | – |

- [ ] A13-1 `routes.ts` created; `showNav` / `activeTab` derived from the URL (**delete `activeTab` from `store/ui.ts`**)
- [ ] A13-2 Routes restructured as a layout route: `<Route element={<AppShell/>}>` wrapping tabs + detail pages; auth routes and `/player` outside it; `AppShell` renders `<Outlet/>` + `<MiniPlayer/>` + `<BottomNav/>`
- [ ] A13-3 Re-tapping the active tab scrolls to top; on a detail page it pops to that tab's root
- [ ] A13-4 Detail screens no longer push `/player` per song — the player opens as a route only from the mini player / a deliberate action
- [ ] A13-5 Nav hidden on splash/auth/onboarding, verified on all 6

---

## A14 (P1) Lyrics / info bugs in the player (logic only, design untouched)

**Where:** `screens/FullPlayer.tsx:35-36,55-78,80-95`.

- **[CONFIRMED]** `lyrics` is never reset on song change and the loader guard is `!lyrics` (`:81`) → the next song shows the **previous song's** lyrics.
- **[CONFIRMED]** `loadLrclib` fetches `https://lrclib.net` directly from the WebView with no timeout/abort and matches on `track_name` only (wrong-song risk).
- **[CONFIRMED]** the synced-lyrics scroll effect depends on `positionMs` (`:95`) → re-runs twice a second.

**Tasks**
- [ ] A14-1 Reset + **cache lyrics per `song.id`**; `// VINARAA-FIX:` comments on every changed line
- [ ] A14-2 `AbortController` (6 s timeout); prefer hits where artist and duration (± 3 s) match; cache in `idb`
- [ ] A14-3 "No lyrics found" empty state with a "Search again" button
- [ ] A14-4 Scroll effect runs only when the active line index changes
- [ ] A14-5 **No visual/layout change anywhere in `FullPlayer.tsx`** (only token colours for bg/status bar if needed)

---

## A15 (P0) Bandwidth & stream contract — protect the 5 GB Render quota

**Where:** `soundwave-backend/src/services/catalog.js:159-176`, `soundwave-backend/src/routes/music.routes.js` (`GET /music/stream/:id`), `app/src/utils/song.ts:17-21`, `scripts/keepalive.js`, `render.yaml`.

**Findings [CONFIRMED]**
- `toClientSong` fills `audio.best` with the **direct `aac.saavncdn.com` URL** → playback already bypasses Render. Keep this.
- The same function also emits `audio.streamUrl: '/api/v1/music/stream/<id>'` — a **relative** path (unusable by a native client) pointing at the **proxy** route, which pipes audio through Render (`Readable.fromWeb(upstream.body).pipe(res)` with Range passthrough).
- The app currently never calls the proxy (it uses `audio.best`) — but nothing prevents a future change from doing so and silently burning the quota.

**Tasks**
- [ ] A15-1 Make `audio.streamUrl` an **absolute** URL (or remove it from the client payload) and document that it is the *proxy* route, not the playback route
- [ ] A15-2 Add an explicit `audio.downloadUrlsPreview` (absolute CDN URLs, all qualities) so the downloader never needs Render
- [ ] A15-3 The app's playback path uses `audio.best` (direct CDN) — assert this in a test; assert `vitest`/manual that no request goes to `/music/stream/` during normal playback
- [ ] A15-4 `/music/stream/:id` defaults to `mode=redirect` (302 to the CDN) unless `mode=proxy` is explicit; document why (`proxy` costs Render bandwidth)
- [ ] A15-5 Keep `mode=proxy` for browser/dev use only
- [ ] A15-6 `scripts/keepalive.js` scheduled externally every 10 min (cron-job.org / UptimeRobot) to avoid 30-60 s cold starts, and `/health` kept as the ping target
- [ ] A15-7 `Cache-Control: public, max-age=60` on `/music/trending` + `/music/modules`; confirm gzip/compression + ETag
- [ ] A15-8 Add `X-Bandwidth-Warning` dev-only header to the proxy route so accidental use is visible in logs

---

## A16 (P1) Offline web assets + notification permission (answering two of your asks)

- **[CONFIRMED]** the web bundle is shipped **inside the APK** (`capacitor.config.ts → webDir: 'dist'`), so the splash, 404 and every static screen already load with no network — **no service worker is needed**. Only *data* fails offline, which is why A07 routes you to Downloads. Add React Query persistence (`@tanstack/query-persist-client-core` + `idb`) so Home/Library also render cached content offline.
- **[CONFIRMED]** `setupOneSignal()` requests notification permission at cold start (`App.tsx:30-33`) and re-runs on every navigation (A05).

**Tasks**
- [ ] A16-1 React Query persistence + offline-first reads for Home/Library
- [ ] A16-2 Notification permission asked in context with a pre-prompt sheet; denied state explained in Settings → Notifications
- [ ] A16-3 Media3 notification custom commands (Like / Repeat) + artwork loaded via a `BitmapLoader` so it never goes blank
- [ ] A16-4 Dynamic-island / live-music preview: keep `MediaStyle` + `setSmallIcon` + artwork + `playbackState` accuracy; verify on Samsung + OnePlus (the OS renders the capsule, so correct metadata is all you control)


---

# PART B — PERFORMANCE, ANDROID HARDENING, DEPENDENCY HYGIENE

## B-1 Performance

Measure **before/after** with Chrome DevTools remote debugging (`chrome://inspect`) and `adb shell dumpsys gfxinfo com.music.vinaraa`.

- [ ] B-1-1 **Route-level code splitting:** `React.lazy` + `Suspense` for every screen except Home/Splash; `recharts` (≈ 100 KB gz) only on Stats; `FullPlayer` lazy but **preloaded** on the first mini-player render.
- [ ] B-1-2 **Remove unused deps** (grep-verified as unused today): `node-vibrant`, `@tanstack/react-virtual` (use it in A12 or drop it), `tailwind-merge`, `clsx`, `autoprefixer` (Tailwind v4 does not need it), `idb` (keep — needed by A06/A16). Run `npx depcheck` and paste the output in the PR.
- [ ] B-1-3 **Actually use React Query.** The provider is mounted (`App.tsx:60-70`) but `useQuery`/`useMutation` appear **zero** times in `app/src`. Move the feed, trending, album, artist, playlist, search, stats and playlists to `useQuery`; persist the cache.
- [ ] B-1-4 **Images:** `loading="lazy"`, `decoding="async"`, explicit `width`/`height`, `utils/image.ts → sized(url, px)` (Saavn supports `50x50/150x150/250x250/500x500`: use 150 for rows, 250 for cards, 500 for hero/player), a solid placeholder + fade-in.
- [ ] B-1-5 **Blur budget.** `backdrop-filter: blur()` is used in ~11 places (`.glass` in `index.css` + per-screen classes) and is very expensive on mid-range Android WebViews. Allowed: bottom nav, mini player (one static 16 px blur each) and sheet scrims. Everywhere else: solid/semi-solid surfaces.
- [ ] B-1-6 **No `transition-all`.** Animate only `transform` and `opacity`; `will-change: transform` only while animating (the current `MiniPlayer.tsx:55` and `BottomNav.tsx` use `transition-all`).
- [ ] B-1-7 **No off-screen infinite animation.** Pause the FullPlayer art pulse (`FullPlayer.tsx:283-286`, `repeat: Infinity`), the shimmer and the equalizer with `animation-play-state` when not visible or when `prefers-reduced-motion`.
- [ ] B-1-8 **Keep-alive tabs:** do not unmount Home/Search/Library/Stats on a tab switch (hide with `visibility` + `transform`), so scroll position and data survive and switching costs ~0 ms; unmount detail pages when popped.
- [ ] B-1-9 **Home:** remove the 5-minute `setInterval` (`Home.tsx:173`); move pull-to-refresh off three `useState`s (it re-renders on every `touchmove`) to a ref + `transform` hook.
- [ ] B-1-10 **Lists:** keys must be stable song ids, never the index.
- [ ] B-1-11 **Fonts:** self-host only the weights used (400/500/600/700/800) + Noto Sans Telugu; preload the two most important woff2 in `index.html`; `font-display: swap`.
- [ ] B-1-12 **Vite build:** `build.target = 'es2020'`, `cssMinify`, `rollupOptions.output.manualChunks` (react / framer-motion / recharts), `esbuild.drop: ['console','debugger']` in production. Target **initial JS < 250 KB gz**.
- [ ] B-1-13 **WebView:** `bridge.webView.setOverScrollMode(View.OVER_SCROLL_NEVER)`; keep hardware acceleration on (`android:hardwareAccelerated="true"`).
- [ ] B-1-14 **Release build:** `minifyEnabled true` + `shrinkResources true` (**currently `minifyEnabled false`**, `app/build.gradle:31-34`) with Capacitor/Media3 keep rules; produce an **AAB**; baseline profile if time allows.
- [ ] B-1-15 **API client:** dedupe identical in-flight GETs, 20 s timeout, `AbortController` per search keystroke (cancel the previous request), keep the 250 ms debounce.
- [ ] B-1-16 **Backend (Render free):** external keep-alive cron (§A15-6), cache headers, ETag verified.

## B-2 Dependency / config hygiene

- [ ] B-2-1 Tailwind v4: delete `tailwind.config.js` **and** the `@config "../tailwind.config.js"` line, move every token into `@theme`, delete the hand-written `.bg-bg/.text-muted/…` shims at the bottom of `index.css` (they bypass the theme and **break opacity modifiers** such as `bg-primary/20`).
- [ ] B-2-2 `capacitor.config.ts`: remove the `SplashScreen` block (§A08) or install the plugin properly; add `server: { androidScheme: 'https' }`, `android: { allowMixedContent: false }`; decide `CapacitorHttp` (V-06 recommends removing it).
- [ ] B-2-3 New deps: `@capacitor/network`, `@capacitor/status-bar`, `@capacitor/haptics`, `@capacitor/share`, `@capacitor/keyboard`, `@fontsource-variable/plus-jakarta-sans`, `@fontsource/noto-sans-telugu`, `@tanstack/query-persist-client-core`, `androidx.security:security-crypto`, `androidx.work:work-runtime-ktx`, `okhttp3`, `media3-datasource-okhttp`.
- [ ] B-2-4 `index.html`: real `<title>Vinaraa</title>`, `lang="en"`, `viewport-fit=cover`, `theme-color` (both schemes), inline critical background, no-flash theme script (§C-3).
- [ ] B-2-5 `.gitignore`: ensure `google-services.json`, keystores and `.env*` are ignored; move the OneSignal App ID + API base into `.env.example`.
- [ ] B-2-6 Rename `package.json` `"name": "app"` → `"vinaraa"`; drive `versionName`/`versionCode` from it in `build.gradle`.
- [ ] B-2-7 Upgrade Media3 **1.3.1 → 1.5.x+** (three artifacts in `app/build.gradle:45-47`) for gapless/seek fixes, and add `media3-datasource-okhttp`.
- [ ] B-2-8 `AndroidManifest.xml`: remove `WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_AUDIO`; add `FOREGROUND_SERVICE_DATA_SYNC` + `WAKE_LOCK`; add `android:windowSoftInputMode="adjustResize"`, `android:enableOnBackInvokedCallback="true"`, `android:allowBackup="false"`, `android:usesCleartextTraffic="false"` + a `networkSecurityConfig`.
- [ ] B-2-9 **Native theme must be DayNight** (missed by the previous file): `res/values/styles.xml` parents `Theme.AppCompat.NoActionBar` with **hard-coded `#090714`** in `windowBackground`/`statusBarColor`/`navigationBarColor`, and there is **no `values-night/`** → a light theme is impossible at native-chrome level. Change the parent to `Theme.AppCompat.DayNight.NoActionBar` (or `Theme.Material3.DayNight.NoActionBar`), move the colours into `colors.xml`/`values-night/colors.xml`, and keep the status/nav bars transparent (`MainActivity.kt:14-16` already sets them transparent).
- [ ] B-2-10 `.oxlintrc.json` + `tsconfig` strictness checked in CI (`npm run lint && npx tsc -b`).

## B-3 PlaybackService hardening (fixes "music stops on screen-off / headset unplug / audio focus")

Current state [CONFIRMED]: `PlaybackService.kt:30-31` is a bare `ExoPlayer.Builder(this).build().apply { setAudioAttributes(audioAttributes, true) }`; `release()` is called inside the media-session block (57-58).

- [ ] B-3-1 Builder: `.setHandleAudioBecomingNoisy(true)` (pause on headset unplug), `.setWakeMode(C.WAKE_MODE_NETWORK)`, `.setAudioAttributes(attrs, /* handleAudioFocus = */ true)`, `.setMediaSourceFactory(DefaultMediaSourceFactory(resolvingDataSourceFactory))`.
- [ ] B-3-2 `LoadControl` tuned for mobile: min 15 s buffer, max 50 s, playback 1.5 s, rebuffer 4 s.
- [ ] B-3-3 `SimpleCache` (LRU ≈ 200 MB) wrapped around the HTTP data source → replays and seek-backs cost no data; loops become instant.
- [ ] B-3-4 Gapless: keep `setPauseAtEndOfMediaItems(false)` and preload the next item.
- [ ] B-3-5 Notification: `MediaNotification` with custom Like/Repeat commands; artwork via a `BitmapLoader` so it never goes blank.
- [ ] B-3-6 `onTaskRemoved`: if not playing → `stopSelf()`; if playing → keep the service alive.
- [ ] B-3-7 Fix `release()` order in `onDestroy`: release the **player first**, then the session (today the player is released inside `mediaSession?.run{}`, so it leaks if the session is null).
- [ ] B-3-8 Optional but recommended (§A01-2 long-term): `ResolvingDataSource` so JS can enqueue instantly with a `vinaraa://song/{id}` placeholder that native resolves (with the bearer token) at play time, cached 10 min.

## B-4 Backend operations

- [ ] B-4-1 `scripts/ensure-indexes.js` documented + run once in production after the schema changes.
- [ ] B-4-2 `scripts/keepalive.js` scheduled externally (§A15-6).
- [ ] B-4-3 Confirm the Mongo TTL indexes still match (`PlayEvent`, `ListeningSession`, `SearchHistory`, `CacheEntry`) and that no `RefreshToken` TTL index remains after deleting the model.
- [ ] B-4-4 Verify `UPSTREAM_URLS` / `UPSTREAM_PATH_PREFIX=/api` and that swapping the Cloudflare Worker URL is still possible live through `POST /admin/upstreams` (the whole point of the load-balancer design) — test with a deliberate bad host.
- [ ] B-4-5 Mongo Atlas: a backup/export routine + a documented restore test.

---

# PART C — FULL REDESIGN A→Z: "Vinaraa Aurora"

> **Goal:** a professional, distinctive, **one-handed**, fast, animated music-app identity with light / dark / system themes.
> ⛔ **HARD RULE — `src/screens/FullPlayer.tsx` visuals are OFF LIMITS.** The owner redesigns that screen himself later. In this whole project you may change **only** its logic (progress sync, back handling, store selectors, duplicate-tracking removal, lyrics reset, and the FEATURE-01 gestures). Every changed line carries `// VINARAA-FIX:`. It **must** consume the new tokens for background/status bar so it doesn't look foreign, but its layout, spacing, controls and typography stay exactly as they are today.

## C-1 Design principles

1. **Thumb zone — the 25 / 75 rule (your main ask).** On a 6.5″ phone split every screen vertically:
   - **Top 25 % (≈ 170-200 dp)** — *low-frequency* things only: a **small** greeting/title, avatar, bell, back, ⋮, rarely-touched filters.
   - **Bottom 75 %** — *everything used constantly*: primary CTAs, play buttons, the content list/grid, segmented tabs, the search field, the bottom nav, the mini player, sheet actions.
   - Primary actions sit **within 3 cm of the bottom edge** (above the nav); destructive/rare actions live in the top zone or behind a long-press/sheet.
   - Sheets are **bottom sheets only** — never centred dialogs or top menus. Back is also reachable by edge-swipe (predictive back).
2. **One bold place.** Spend the boldness on the **aurora gradient** (violet → magenta → coral) used for the primary play button, the active tab pill, the hero card and the auth artwork. Everything else stays calm and disciplined — exactly like your screenshots, where magenta artwork is the only strong colour.
3. **Motion answers touch.** Every animation must depict an opening / expanding / confirming action. No decorative loops except the now-playing equalizer and loading states. **One orchestrated entrance per screen** (a 3-step stagger of the first visible rail), never fade-slide on every element.
4. **Honest status.** Every wait shows a specific, human state (§C-9) — never a blank screen or a spinner alone.
5. **Content first.** Artwork is the colour; chrome is neutral. Album art tints the mini player and detail header (dominant colour, composited over `--c-bg` at ≤ 35 % opacity so text contrast survives).
6. **Copy:** sentence case, active verbs ("Play", "Save to playlist", "Download"), no "Submit/OK". Errors say *what happened + how to fix*.

## C-2 Design tokens (Tailwind v4 `@theme`, paste into `src/index.css`)

Dark = **"Midnight"** (default), light = **"Lavender mist"**. Verified contrast (WCAG): text/bg 17.6 dark, 6.0 light; muted/bg 8.4 / 6.0; white on the primary gradient end ≥ 4.6 → all ≥ 4.5:1.

```css
@import "tailwindcss";
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  --color-bg:            var(--c-bg);
  --color-surface:       var(--c-surface);
  --color-surface-2:     var(--c-surface-2);
  --color-surface-3:     var(--c-surface-3);
  --color-line:          var(--c-line);
  --color-ink:           var(--c-ink);
  --color-ink-2:         var(--c-ink-2);
  --color-primary:       var(--c-primary);
  --color-primary-press: var(--c-primary-press);
  --color-primary-soft:  var(--c-primary-soft);
  --color-accent:        var(--c-accent);
  --color-mint:          var(--c-mint);
  --color-amber:         var(--c-amber);
  --color-danger:        var(--c-danger);

  --font-sans: "Plus Jakarta Sans Variable", "Noto Sans Telugu", system-ui, sans-serif;

  --radius-chip: 999px;
  --radius-card: 20px;
  --radius-art: 16px;
  --radius-hero: 28px;
  --radius-sheet: 28px;

  --shadow-card: 0 1px 0 var(--c-line), 0 8px 24px -12px rgb(0 0 0 / .35);
  --shadow-glow: 0 12px 32px -10px rgb(109 59 240 / .55);
  --shadow-sheet: 0 -16px 48px -12px rgb(0 0 0 / .5);

  --ease-out-expo: cubic-bezier(.16, 1, .3, 1);
  --ease-standard: cubic-bezier(.2, 0, 0, 1);
  --animate-eq: eq 900ms ease-in-out infinite;
  @keyframes eq { 0%,100% { transform: scaleY(.25) } 50% { transform: scaleY(1) } }
}

:root, [data-theme="dark"] {                /* MIDNIGHT (default) */
  --c-bg:#0B0A1A; --c-surface:#15132B; --c-surface-2:#1E1B3A; --c-surface-3:#292552;
  --c-line:#2D2A55; --c-ink:#F3F1FF; --c-ink-2:#A9A5D1;
  --c-primary:#9B6BFF; --c-primary-press:#8456F0; --c-primary-soft:#2A2058;
  --c-accent:#FF6B8A; --c-mint:#34E0B4; --c-amber:#FFC247; --c-danger:#FF6B86;
  --g-aurora: linear-gradient(135deg,#6D3BF0 0%,#B33AD8 55%,#FF5C8A 100%);
  color-scheme: dark;
}
[data-theme="light"] {                       /* LAVENDER MIST */
  --c-bg:#F7F5FF; --c-surface:#FFFFFF; --c-surface-2:#EFEBFF; --c-surface-3:#E3DDFA;
  --c-line:#DDD6F5; --c-ink:#16132B; --c-ink-2:#5E5A82;
  --c-primary:#6D3BF0; --c-primary-press:#5A2BD8; --c-primary-soft:#ECE5FF;
  --c-accent:#D6307E; --c-mint:#0E9F7E; --c-amber:#B7791F; --c-danger:#C62D4E;
  --g-aurora: linear-gradient(135deg,#6D3BF0 0%,#B33AD8 55%,#E8366F 100%);
  color-scheme: light;
}
```

- [ ] C-2-1 `.bg-aurora` utility from `--g-aurora`; white text on it only at weight ≥ 700
- [ ] C-2-2 **Delete every literal hex from `.tsx`** — including `#8B3DFF` in `FullPlayer.tsx:390` (progress gradient), `#8B3DFF` shadows in `BottomNav.tsx:52`, and recharts `fill` values in `Stats.tsx` → use `var(--c-…)`
- [ ] C-2-3 Delete the old `.glass` / `.gradient-text` utilities; create `.surface-blur` as the **only** blur (nav + mini player)

## C-3 Themes: Light / Dark / System

- [ ] C-3-1 `store/settings.ts` (zustand `persist`): `theme: 'system' | 'light' | 'dark'`
- [ ] C-3-2 **No flash:** inline script in `index.html` `<head>` before paint:
  ```html
  <script>
    try {
      var t = JSON.parse(localStorage.getItem('vinaraa-settings') || '{}').state?.theme || 'system';
      var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    } catch (e) { document.documentElement.dataset.theme = 'dark'; }
  </script>
  ```
- [ ] C-3-3 Listen to `matchMedia('(prefers-color-scheme: dark)')` changes while `theme === 'system'`
- [ ] C-3-4 `@capacitor/status-bar`: `Style.Dark` on a light bg, `Style.Light` on dark; `overlaysWebView: true`; sync the nav bar through a tiny plugin method `setSystemBars({ dark })`
- [ ] C-3-5 Android `values/` + `values-night/` colours for `vinaraa_bg`; splash follows the system theme
- [ ] C-3-6 Album-art tinting: dominant colour per image (small canvas sampler, cached by URL — **not** `node-vibrant`, which is unused and heavy) → detail header gradient + mini-player glow, always ≤ 35 % opacity

## C-4 Typography

- **Family:** *Plus Jakarta Sans* (variable) as sans + **Noto Sans Telugu** as an explicit fallback. **Remove Sora.** Reason [CONFIRMED]: the catalogue is Telugu-heavy and neither Sora nor Plus Jakarta Sans contains Telugu glyphs, so Telugu titles currently fall back to a random system font and break line heights.
- **Scale** (size / line-height / weight / tracking):

| Token | Use | Size / LH | Weight | Tracking |
|---|---|---|---|---|
| `display` | Welcome & auth hero | 40 / 44 | 800 | −0.03em |
| `title-1` | Screen title | 28 / 34 | 800 | −0.02em |
| `title-2` | Section header ("Jump back in") | 20 / 26 | 700 | −0.01em |
| `title-3` | Card/row title | 16 / 22 | 700 | 0 |
| `body` | Paragraphs, inputs | 15 / 22 | 500 | 0 |
| `caption` | Artist, meta | 13 / 18 | 500 | 0 |
| `micro` | Nav labels, chips | 11 / 14 | 600 | +0.01em |

- [ ] C-4-1 Telugu text: `line-height +2 px`
- [ ] C-4-2 `font-variant-numeric: tabular-nums` on **all** times/durations/counters (stops the counter jitter)
- [ ] C-4-3 Home greeting is **small**: `caption` ink-2 ("Good evening") + `title-3` name, inline with the avatar, total height ≤ 56 px (your "reduce the top bar" ask)
- [ ] C-4-4 Sentence case everywhere; no ALL-CAPS labels except the tiny in-card eyebrow badge

## C-5 App shell, navigation and the "open from the tab" animation

### C-5.1 Bottom navigation (floating pill)

- 64 px high, `inset-x-3`, bottom `calc(env(safe-area-inset-bottom) + 8px)`, radius 28, `surface-blur` + 1 px line, `shadow-card`.
- **5 destinations (matches your screenshots):** Home · Search · Library · Stats · Profile (avatar circle). *Downloads lives inside Library and becomes the landing tab automatically when offline.*
- **Active tab:** an aurora gradient pill slides behind icon+label (`layoutId`, spring 420/34); active = filled icon + visible `micro` label; inactive = outline icon only.
- Tap feedback: scale 0.92 → 1 (120 ms) + light haptic. Badge dot on Library while downloads are running.
- Offline: Search & Stats at 40 % opacity with a tiny wifi-off glyph; tap → toast "Search needs internet".
- Mini player stacks **above** the pill (8 px gap) in the same container, so both move together; hide the pill when the keyboard opens (`@capacitor/keyboard`).

### C-5.2 "The page opens from the tab you tapped" — exact recipe from your screenshots

Your images 3 → 4 → 5 are the reference: the app appears as a **small, heavily-rounded, centred card over the background**, grows to nearly full-screen (still rounded, chrome appearing), then settles full-bleed with the nav visible. Reproduce that:

**Tab switches**
1. On tap, measure the icon centre (`getBoundingClientRect`) → `originX`, `originY`.
2. Incoming page with `transform-origin: {originX}px {originY}px`:
   - **enter:** `scale .86 → 1`, `opacity 0 → 1`, `clip-path: inset(0 round 36px → 0px)`, `y 24 → 0`; spring `{ stiffness: 380, damping: 34, mass: 0.9 }` ≈ 360 ms.
   - **exit (previous page):** `scale 1 → .96`, `opacity 1 → 0`, 180 ms `ease-standard`, `pointer-events: none`.
   - Keep both mounted during the overlap (`mode="popLayout"` / keep-alive stack) — **never `mode="wait"`** (today it costs ~0.85 s: `Navigator.tsx:34` + `motion.ts` 0.42 + 0.42).
3. Direction cue: moving to a tab on the right adds `x: +16 → 0` (left: −16 → 0); skip the offset when the tab distance is 1.
4. Background behind pages is `--c-bg` so a scaling page never exposes white.
5. Animate only `transform` / `opacity` / `clip-path` (radius via `clip-path: inset(0 round r)` is cheaper than animating `border-radius` on a full-screen layer).
6. `prefers-reduced-motion`: crossfade 120 ms, no scale.
7. **Chrome timing (from image 4):** the mini player and nav pill **fade/rise in during the last third** of the expansion (delay ≈ 200 ms, 160 ms fade, `y 12 → 0`), not at t=0 — that is what makes it feel like the app "grows open".

**Cold launch:** after the native splash, the first screen **expands from the centred logo** (same recipe, origin = screen centre) instead of a hard cut.

**Detail pages (Album / Artist / Playlist):** shared-element transition — the tapped card's artwork (`layoutId="art-{type}-{id}"`) expands into the page header while the title cross-slides; the body fades up 8 px with a 3-item stagger (40 ms). Back reverses it and supports edge-swipe with the page following the finger (previous page parallax 30 %).

**Mini player → full player:** artwork morphs (`layoutId="player-art"`), background sweeps from the mini-player tint, 420 ms. *(This is a transition only — the FullPlayer layout itself stays untouched.)*

### C-5.3 Layout skeleton (every tab screen)

```
┌──────────────────────────────┐
│ ▓ top 25 % ▓ (≈170-200 dp)   │  small greeting/title, avatar, bell, ⋮
│  (low-frequency, glanceable) │  collapses to 48 dp on scroll
├──────────────────────────────┤
│   bottom 75 %                │  rails / list / grid, chips, segmented tabs
│   (everything frequent)      │  primary CTA
├──────────────────────────────┤
│  mini player (56)            │
│  floating nav pill (64)      │
└──────────────────────────────┘
```

- [ ] C-5-3 Header collapses on scroll (title 28 → 17 px, secondary controls hide) using `transform`
- [ ] C-5-4 `--bottom-chrome` CSS variable = nav + mini player + safe area; every scroll container uses `padding-bottom: calc(var(--bottom-chrome) + 16px)` (fixes 9.3)
- [ ] C-5-5 Pull-to-refresh: custom aurora spinner in the top zone + a "Refresh" item in the overflow

## C-6 Motion tokens

| Token | Value |
|---|---|
| `dur-micro` | 120 ms (press, toggle) |
| `dur-short` | 200 ms (fade, chip) |
| `dur-medium` | 320 ms (sheet, page push) |
| `dur-long` | 450 ms (hero, shared element) |
| `spring-snappy` | stiffness 420 / damping 34 |
| `spring-soft` | stiffness 220 / damping 26 |
| `spring-sheet` | stiffness 300 / damping 32 |
| `ease-out` | `cubic-bezier(.16,1,.3,1)` |
| stagger | 40 ms per item, max 6 items |

- [ ] C-6-1 `active:scale-[0.97]` (120 ms) on **every** tappable
- [ ] C-6-2 Global `useReducedMotion()`: no shared-element/scale, fades ≤ 120 ms, equalizer frozen
- [ ] C-6-3 Haptics: light on tab change, medium on play/pause, success on "added to playlist"

## C-7 Component library (`src/ui/`, used everywhere; each has default / pressed / disabled / loading / error)

| Component | Spec |
|---|---|
| `Button` | primary (aurora, white 700, h 52, r 999, `shadow-glow`) · secondary (surface-2 + 1 px line) · ghost · danger. Sizes lg 52 / md 44 / sm 36. Loading = label in progressive tense + 18 px spinner, **width locked** (no layout jump), `aria-busy`. Min touch 48. |
| `IconButton` | 44×44 circle, surface-2, 24 px icon, pressed overlay. |
| `Chip` / `SegmentedTabs` | Pill h 36; selected = aurora or `primary-soft` + primary text (gradient only for **one** main filter per screen); sliding indicator `layoutId`; horizontal scroll with edge fade + snap. |
| `Input` | h 56, r 16, surface-2, 1 px line; **floating label**, leading 20 px icon, trailing action (show/hide password, clear); focus ring 2 px primary; error = 1.5 px danger + message with icon; success tick; autofill-aware (`autocomplete`, `inputMode`, `enterKeyHint`). |
| `Card` (media) | Square art r 16-20, `title-3` (1 line, Telugu-safe), `caption` (1 line), 40 px aurora play FAB bottom-right; press scale .97; sizes 120 (rail) / 160 (grid) / full-width hero. |
| `ArtistCircle` | 88 px circle, name centred, gradient ring on press. |
| `SongRow` | 64 px: art 48 (r 12) · title/artist · duration (tabular) · ⋮. **Now playing:** title in primary, `NowPlayingBars`, row bg `primary-soft`. Paused = bars frozen at 40 %. Downloaded = ✓ glyph. Swipe-right = Play next, swipe-left = Add to queue (haptic + toast). Long-press = action sheet. |
| `NowPlayingBars` | 3-4 bars, 3×14 px, r 2, `bg-primary`, `animate-eq` with 0/150/300/450 ms delays, `transform-origin: bottom`. **Shown beside the playing song in every list**, in the mini player, and on Library playlist cards whose playlist is the current context. Animated only when `isPlaying`; static when paused; off with reduced motion. |
| `ActionSheet` | Handle 36×4, r-top 28, header = art + title + artist, actions ordered by frequency: Play next · Add to queue · Add to playlist · Download (stateful) · Go to album · Go to artist · Share · (danger) Remove. Rows 56 with 22 px icons. Swipe-down + back dismiss. |
| `Toast` | **Bottom-anchored above the nav pill** (today it is `fixed top-0`, `components/Toast.tsx:15` — wrong for one-hand use): success (mint ✓) / error (danger) / info + optional action (Undo, Retry). 3.5 s, swipe to dismiss, max 2. |
| `Skeleton` | Shapes matching the final layout; one shared shimmer sweep via `transform` on a pseudo-element (not `background-position`), 1.4 s; off for reduced motion. |
| `EmptyState` | Line icon in a 72 px surface-2 circle + 1-line title + 1-line help + primary action. |
| `ErrorState` | Icon + what happened + **Retry**; offline variant offers "Go to Downloads". |
| `ProgressRing` | 28 px SVG ring for downloads (tap = cancel). |
| `NetworkBanner` | 28 px strip: offline / "Waking up the server…" / "Back online" (auto-hide 2 s). |
| `TopLoadingBar` | 2 px aurora line for any route/query > 400 ms. |
| `Avatar` | Initial on aurora or image; 36 / 44 / 96. |
| `Switch` | 52×32, 24 px thumb, spring, on = primary, `role="switch"`. |
| `Slider` | Volume/crossfade; 44 px touch area, 4 px track. |
| Icons | **Lucide only**, stroke 2, sizes 20/24, filled variant for the active tab; **no emoji in UI** (e.g. the `🎵` fallback → `Music2`). Brand marks: multi-colour Google "G" SVG. |

**Spacing/shape:** 4 px grid · screen padding 20 · section gap 28 · card gap 12 · radii chip 999 / card 20 / art 16 / hero 28 / sheet 28 / input 16 / button 999 · shadows only on floating elements · touch ≥ 48 dp, primary 52-56.


---

## C-8 Screen-by-screen redesign (A → Z)

For each screen: **layout (25/75)**, **content**, **states**, **motion**.

### 1) Native splash + Splash (`/`)
- Native splash and web splash are **visually identical**: bg `--c-bg`, centred Vinaraa "V" (96 dp), **no text, no circle** (§A08).
- Web splash: if auth + network resolve in < 600 ms → **no animation at all**, straight to the target. If slower → the mark gets a 3-bar equalizer pulse and one status line ("Checking your session…" / "Waking up the server…").
- Logic: no token → `/welcome`; token + online → `/home`; token + offline → `/downloads`.
- Exit: cross-fade + expand (origin = screen centre) into the next screen.
- [ ] C-8-1 Implemented · [ ] C-8-2 Offline-capable (already true — assets ship in the APK)

### 2) Welcome (after splash, when not logged in) — "full-page image" style
- **Background:** full-bleed gradient art — deep indigo `#2B1A8F → #5B2BE0` base, two large **blurred orbs** (coral→magenta top-right, cyan→coral left-middle) + 2 % film grain. Orbs drift on a 20 s transform loop (paused for reduced motion). On low-end devices (`navigator.hardwareConcurrency ≤ 4`) use a pre-rendered WebP ≤ 120 KB instead of live blur.
- **Layout (25/75):** top 40 % artwork only (no controls). Bottom 60 %: headline `display` white, max 3 lines ("Listen to Telugu & Indian music, everywhere."); 2-line subcopy 80 % white; then a row with **"Get started"** (700) on the left and a **64 px round aurora arrow button** on the right with a soft pulsing ring — the whole row is one tap target; below, "I already have an account · Sign in".
- 3 swipeable pages with dots above the CTA row: (1) Listen anywhere, (2) Downloads for offline, (3) Made for your taste. Each page shifts the orb palette (violet/pink → teal/coral → amber/magenta). Page 2 is the kinetic-type layout of your reference: stacked words **Player / Discover / Charts / Library** at weight 800, inactive words struck through, the active word in coral, with a line-art waveform (SVG, orange→red→teal gradient) rising behind the text.
- Motion: headline reveals line-by-line (mask slide-up, 40 ms stagger) once; arrow press → ripple + route push with the orbs scaling up 200 ms.
- [ ] C-8-3 Background art + orbs · [ ] C-8-4 3 pages + dots · [ ] C-8-5 arrow-button row · [ ] C-8-6 reduced-motion + low-end fallback

### 3) Login & Register — ONE screen with a segmented switch
- **Structure (thumb-first):** dark hero on top (≈ 32 %): back button top-left (44 px), headline `title-1` white **"Welcome back"** / **"Create your account"** (animated swap), 1-line subcopy ink-2, soft aurora orb / waveform art behind. A **bottom-sheet card** (≈ 68 %, r-top 32, `--c-surface`, springs up on mount) holds everything interactive:
  1. **Segmented switch** `Login | Register` (full width, h 52, sliding thumb `layoutId`); switching cross-fades the form (200 ms + 12 px x-slide), swaps the hero headline and changes the URL to `/login` / `/register` **without re-mounting the sheet**.
  2. **Fields** (floating label + leading icon): Login → Email, Password (eye toggle). Register → Name, Email, Password (4-segment strength meter), Confirm optional.
  3. Row: **Remember me** (since tokens never expire this only pre-fills the email) · **Forgot password?** (right, primary).
  4. **Primary button** ("Log in" / "Create account") aurora, full width, 56 px, docked at the bottom of the sheet above the safe area; keyboard-aware (`adjustResize`, the sheet scrolls, the button stays reachable).
  5. "Or continue with" → Google + Facebook outlined buttons, **disabled with a "Coming soon" tooltip** until OAuth endpoints exist (V-01).
  6. Footer caption: "By continuing you agree to the Terms and Privacy Policy".
- **Validation:** inline on blur + on submit; error text under the field with an icon; shake (6 px, 2 cycles, 240 ms) + error haptic on a failed submit, typed values preserved. Error copy map: `INVALID_CREDENTIALS` → "Email or password is incorrect" · `EMAIL_TAKEN` → "This email already has an account. Log in instead." (link flips the switch) · `ACCOUNT_LOCKED` → "Too many attempts. Try again in 15 minutes." · network → "Can't reach Vinaraa. Check your connection and try again."
- **Submit state:** button → "Signing in…" + spinner, fields disabled, top progress bar; if the server is asleep after 4 s show "Waking up the server… this can take up to a minute" under the button.
- **After success:** login → `/home` (or `/downloads` offline); register → `/onboarding`. Success micro-animation: the sheet slides down while the next screen expands from the button position.
- Accessibility: labels bound to inputs, `aria-live="polite"` error region, focus moves to the first invalid field.
- ⚠️ **Your message mentions a login/register reference image, but the five images provided do not include one** (they show the launcher and the app-opening animation). Send that image and I will match the artwork exactly; the layout above is already spec-complete without it.
- [ ] C-8-7 Hero + sheet structure · [ ] C-8-8 segmented switch + URL sync · [ ] C-8-9 floating-label inputs + validation copy · [ ] C-8-10 loading/waking states · [ ] C-8-11 social buttons disabled · [ ] C-8-12 keyboard behaviour on a real device

### 4) Forgot / Reset password
- Same hero + sheet pattern (hero "Reset your password"). Step 1: email → "Send reset link" → confirmation with a mail icon, "Check your inbox", "Resend in 30 s" countdown. Step 2 (`/reset-password`): new password + strength meter + "Update password" → toast → Login. All controls in the thumb zone.
- [ ] C-8-13 Both steps + countdown + success path

### 5) Onboarding (language / artists / genres)
- Hero top 25 %: step title + 3-step progress bar. Bottom 75 %: bubble/grid selection (chips 48, artist circles 88) with a spring "pop" on select (scale 1.08 → 1) and a check badge; sticky bottom bar with "Skip" (ghost) and **"Continue · 3"** (primary, shows the count); inline minimum-selection hint. Final step → "Creating your mixes…" progress state (calls `onboarding.complete`) → expand into Home.
- [ ] C-8-14 Selection bubbles + sticky CTA · [ ] C-8-15 completing state + error retry

### 6) Home (`/home`) — reduced top bar, small greeting
- **Top (≤ 56 px, collapsible):** left `caption` "Good evening" over `title-3` first name; right bell `IconButton` 40 + avatar 36. No big title.
- **Bottom 75 %, most useful first:**
  1. **Continue listening** — rail of the last 8 (card 120) with play FAB; the first card shows a progress sliver.
  2. **Quick picks** — 2-column grid of 6 compact tiles (art 48 + title; tap = play) — this replaces "Jump Back In".
  3. **Hero "Top pick for you"** — 1 card, aurora overlay, big play button bottom-right, 220 px, r 28.
  4. Rails: *Made for you* (`playlists.system()`) · *Trending in Telugu* · *Featured playlists* · *Music directors* (artist circles) · *New releases* · *Albums*; each with `title-2` + "See all".
  5. Language chips (Telugu / Hindi / Tamil / English…) as a sticky filter row under the top bar.
- States: skeleton of the same layout on first load; cached data shown instantly then refreshed (SWR); **per-rail error with Retry** (one failing rail must not blank the page); offline → go to Downloads with the banner.
- Motion: first-screen rails stagger (max 3) once; press-scale on cards; hero artwork parallax 8 % on scroll.
- [ ] C-8-16 Compact header · [ ] C-8-17 Continue listening + quick picks · [ ] C-8-18 hero + rails + chips · [ ] C-8-19 per-rail error/retry + skeletons · [ ] C-8-20 remove the 5-min interval (9.5)

### 7) Search (`/search`) — redesigned, thumb-first (your explicit ask)
- **The search field is docked at the bottom**, above the nav pill (h 56, r 28, surface-2, mic/clear trailing); tapping lifts it above the keyboard. The top 25 % holds only a small "Search" title + filter chips (All · Songs · Albums · Artists · Playlists).
- **Empty state (no query) — "Recent" = the last 8 things you opened**, as **preview cards in a 2-column grid** anchored just above the search field (newest nearest the thumb). Each card: artwork (r 16), title, `caption` with the type ("Song · Artist", "Album · 2024", "Artist", "Playlist"); song cards get a **play FAB** on the artwork (tap = play instantly; tap elsewhere = open). **Tap behaviour: Song → plays** (long-press → action sheet) **· Album → `/album/:id` · Artist → `/artist/:id` · Playlist → `/playlist/:id`.** Clear-all in the top zone + swipe-to-remove a card.
  - **New plumbing required [CONFIRMED missing]:** today `Search.tsx:70-72` renders raw `users.searchHistory()` rows (shape `{query, scope, resultCount}` from `SearchHistory.js`) — there is **no record of a clicked entity anywhere**, so "tap a recent card to open the album" cannot work yet. Add (a) a local `idb` list `{type,id,name,image,subtitle,at}` capped at 8, de-duped, written on every result tap **and** on play; and (b) a backend extension: a `clickedEntityId`/`entityType` field on `SearchHistory` (or a new `/users/me/recent-entities` endpoint) so it syncs across devices. Typed-query history stays as a second section ("Recent searches", text rows, max 5).
- **Typing state:** instant suggestions list (text rows with a ↖ fill button) → at 3 chars, **grouped results**: *Top result* (large card) · *Songs* (rows with play + ⋮) · *Albums* (cards) · *Artists* (circles) · *Playlists* (cards), each header with "See all".
- States: "Searching…" skeleton rows shaped like results; no results → `No results for "{q}" — try another spelling or search by artist`; error → retry; offline → search inside Downloads only + banner.
- Cancel the in-flight request on every keystroke; keep results when returning from an album page (keep-alive).
- [ ] C-8-21 Bottom-docked search field · [ ] C-8-22 recent-entity store (idb) + backend field · [ ] C-8-23 preview cards with play FAB + correct tap routing · [ ] C-8-24 grouped results + top result · [ ] C-8-25 skeletons / empty / error / offline states

### 8) Library (`/library`)
- Top 25 %: small "Library" title, create-playlist `+` IconButton, search-in-library icon.
- Bottom 75 %: **segmented tabs** Playlists · Liked · Downloads (· Artists only when the backend can follow — V-02).
  - **Playlists:** system playlists as 2 large gradient tiles (Liked Songs, On repeat, Taste mix) then user playlists as rows with a 4-cover mosaic, song count, and now-playing bars when the playlist is the current context. Floating **"New playlist"** FAB above the nav → bottom sheet with a name field + visibility.
  - **Liked:** rows with a filled heart (tap = unlike with an Undo toast) + a sticky "Play all / Shuffle" bar.
  - **Downloads:** storage summary card ("1.2 GB · 84 songs") + in-progress cards + list; "Delete all" in the overflow.
- Pull-to-refresh, skeletons, empty states with an action ("Create your first playlist").
- [ ] C-8-26 Segmented tabs · [ ] C-8-27 playlist mosaic rows + FAB sheet · [ ] C-8-28 liked + downloads segments · [ ] C-8-29 states

### 9) Downloads (`/downloads`, also the offline home)
- Top 25 %: "Downloads" + a storage chip + a small "Offline" status. Bottom 75 %: big **"Play all"** and **"Shuffle"**, then the list. Tap a row = play from the local file instantly. Row ⋮ → Remove download. Empty (offline): "No downloads yet. Connect to the internet and tap ⬇ on any song." + "Retry connection".
- Active downloads pinned on top with `ProgressRing` + speed/ETA + cancel.
- [ ] C-8-30 Screen + states · [ ] C-8-31 active-download cards

### 10) Stats (`/stats`)
- Top 25 %: "Your stats" + a compact range segmented control (7d · 30d · 90d · All; 24h/180d under "More").
- Bottom 75 %: **hero metric card** (aurora, big total listening time, delta vs the previous period) · 2 small cards (Songs played, Unique tracks) · **bar chart** (recharts, theme colours, rounded bars) · **Top songs** (rank + art + now-playing bars) · **Top artists** (circles) · **By language** bars (animated width) · **Insights** as horizontally swipeable cards.
- States per §A11 (error ≠ empty!). Count-up animation on the hero number once per range change (600 ms).
- [ ] C-8-32 Range control · [ ] C-8-33 hero + metric cards + count-up · [ ] C-8-34 chart with tokens · [ ] C-8-35 top lists + insights · [ ] C-8-36 error/empty/skeleton distinct

### 11) Album / Artist / Playlist — **nav + mini player visible (§A13)**
- **Header:** artwork-tinted gradient; art 200 px centred (album/playlist) or circular 160 (artist); back top-left, ⋮ top-right (top zone). Title `title-1` (2 lines, Telugu-safe), meta `caption` (year · n songs · duration).
- **Sticky action bar in the thumb zone** (pinned above the list and re-pinned above the nav while scrolling): big **Play** (aurora, flex-1, 52) · **Shuffle** (secondary 52) · **Download all** (stateful ⬇ → ring → ✓) · **Like/Follow**.
- Song list: `SongRow` with index numbers (albums), now-playing bars, swipe actions, duration. **Play next / Add to queue must work here (§A01).**
- **Artist:** tabs Songs · Albums · Singles · Similar; "Top songs" (5 + See all), Albums rail, "Appears on", bio collapsed to 3 lines; artist chips link to artist pages.
- **Playlist (owner):** Edit → rename, visibility, drag-to-reorder (handle on the right), remove with Undo.
- Loading: header skeleton + 8 row skeletons; error: retry; the artwork persists from the tapped card via the shared element so the page never flashes blank.
- [ ] C-8-37 Header + tinted gradient · [ ] C-8-38 Sticky thumb-zone action bar · [ ] C-8-39 Artist tabs · [ ] C-8-40 Playlist edit mode · [ ] C-8-41 skeletons ↔ loaded shared element

### 12) Profile (`/profile`) and Settings (`/settings`)
- **Profile:** top 25 %: avatar 80 + name + handle + "Edit"; bottom 75 %: a 3-number stats summary, quick links (Downloads, Liked songs, Stats), Settings row, Log out. Edit profile = bottom sheet.
- **Settings — grouped list in the bottom 75 %** (rows 56, group titles `caption` ink-2, each group a surface card r 20):
  1. **Account** card (avatar, name, email, chevron) — top zone, rarely tapped. + **devices list** with "Log out of all devices" (§A10-A9).
  2. **Appearance:** Theme → segmented **System / Light / Dark** (inline, thumb-reachable); accent preview; Reduce motion toggle.
  3. **Playback:** audio quality (Auto / Low 96 / Normal 160 / High 320 – bottom-sheet picker, optimistic save, fixes 9.6); streaming quality on mobile data; crossfade slider 0-12 s; gapless; normalize volume; autoplay similar.
  4. **Downloads:** quality; **Wi-Fi only**; storage used + "Clear downloads"; location info.
  5. **Notifications:** push on/off (opens system settings when blocked); new-release alerts.
  6. **Data & privacy:** data saver; clear cache; listening-history tracking on/off; export my data (later).
  7. **About:** version (tap 7× = debug panel with the tracking status line, §A11-6), terms, privacy, licences, rate Vinaraa.
  8. **Log out** — full-width danger text button at the very bottom with a confirmation sheet ("Log out of Vinaraa? Your downloads stay on this device.") — never silently.
- Every toggle: instant optimistic save, rollback + toast on failure; **only expose toggles that are actually implemented** (V-05).
- [ ] C-8-42 Profile layout · [ ] C-8-43 Settings groups + theme control · [ ] C-8-44 optimistic prefs via React Query · [ ] C-8-45 logout confirmation sheet

### 13) Offline (`/offline`) and NotFound (`*`)
- Offline now redirects to `/downloads`; keep `/offline` as a fallback for screens that cannot work offline: icon, "You're offline", "This needs internet. Your downloads are still available.", primary "Open downloads" + secondary "Try again".
- NotFound: "This page doesn't exist" + "Go home".
- [ ] C-8-46 Both screens + correct routes

### 14) Global overlays
- **Queue sheet:** "Now playing" pinned on top with bars, "Next up" with drag-to-reorder (handle on the right, thumb side), swipe-to-remove with Undo, "Clear queue" in the header. Uses native `moveItem/removeAt` (§A01).
- **Add-to-playlist sheet:** search field at the bottom, "New playlist" first row, then existing playlists; success toast with "View".
- **Permission prompts:** notification permission asked in context after the first like/download with a custom pre-prompt sheet explaining why.
- **Action sheet:** per §C-7.
- [ ] C-8-47 Queue sheet with native reorder/remove · [ ] C-8-48 Add-to-playlist sheet · [ ] C-8-49 permission pre-prompt

### 15) Player gestures (FEATURE-01) — **logic only, no visual redesign**
| Gesture | Where | Result |
|---|---|---|
| Swipe **up** | on the album art | Lyrics view slides up and replaces the art (art shrinks to a top thumbnail via `layoutId`) |
| Swipe **up** | on the transport controls | Info panel (album, singers, music director, lyricists, actors, language, year, duration, quality) slides up as a half-height sheet, draggable to full height |
| Swipe **down** | in lyrics / info | go back one level (info → previous view, lyrics → photo) |
| Swipe **down** | in photo view | **minimise** → mini player (`navigate(-1)`, art travels to the mini-player thumbnail) |
| Swipe **left / right** | on the art | previous / next song (12 px drag-follow, snap back under 80 px) |
| Tap | on the art | no action |

- [ ] C-8-50 framer-motion `drag="y"` with `dragDirectionLock`, elastic + velocity thresholds (`offset.y < -80 || velocity.y < -500` → up; `offset.y > 100 || velocity.y > 600` → down)
- [ ] C-8-51 Replace the current `drag="x"` + `dragListener={false}` + `useDragControls` hack (`FullPlayer.tsx:243-253,276-283`) with **one** handler per zone (art zone, controls zone) so vertical and horizontal gestures don't fight `touch-action: none` on the art zone only
- [ ] C-8-52 The lyrics list keeps native scrolling (`pan-y`) and only yields the gesture when `scrollTop === 0` + downward drag
- [ ] C-8-53 The seek slider is protected: `data-no-swipe` + `onPointerDownCapture={e => e.stopPropagation()}` — **no accidental seek while swiping**
- [ ] C-8-54 Light haptic when a gesture commits
- [ ] C-8-55 **Accessibility: keep the visible lyrics / info / close buttons as alternatives** — gestures are shortcuts, not the only path
- [ ] C-8-56 Hardware Back order: info closes → lyrics → photo → minimise
- [ ] C-8-57 **The FullPlayer layout/spacing/typography is unchanged** (verify with a screenshot diff before/after)

## C-9 Loading, progress and status — "tell the user what is happening" (your ask)

| Situation | What the user sees |
|---|---|
| Route change > 400 ms | `TopLoadingBar` aurora line |
| First load of a list | Skeleton of the final layout (never blank, never a lone spinner) |
| Background refresh | 16 px spinner next to the section title, content stays visible |
| Button action | Label changes to progressive tense + spinner ("Saving…", "Downloading…") |
| Song buffering | Play button becomes a spinner; the time counter freezes; after 8 s "Slow connection…" |
| Resolving a stream URL | Thin indeterminate bar under the row title ("Getting song…") |
| Download | Ring 0-100 %, "Downloading 3 of 12", notification progress |
| Server asleep (Render) | Banner "Waking up the server… this can take up to a minute" with an elapsed timer, then auto-retry |
| Offline | Banner + disabled online-only features |
| Error | Icon + cause + Retry (never silent) |
| Success | Toast with a consistent verb ("Saved to playlist", "Downloaded", "Removed") + Undo where possible |

## C-10 Accessibility & quality floor
- [ ] C-10-1 Contrast ≥ 4.5:1 text / ≥ 3:1 icons **in both themes** (use the verified tokens)
- [ ] C-10-2 Touch targets ≥ 48 dp; `aria-label` on every icon-only button; `role="tablist/tab"` on segmented controls; `role="switch"` on toggles; `aria-live` for toasts/errors
- [ ] C-10-3 Visible focus ring (external keyboard / TalkBack)
- [ ] C-10-4 System font scale up to 200 % without clipping (use `rem`, no fixed heights on text containers)
- [ ] C-10-5 RTL-safe logical properties (`ps-`, `pe-`, `start-`, `end-`)
- [ ] C-10-6 Reduced motion honoured everywhere
- [ ] C-10-7 Tested at 320 dp / 393 dp / 600 dp (tablet: centre content at `max-w-[480px]` or 2-column grids)

---

# PART D — EXECUTION PLAN, ACCEPTANCE TESTS, MASTER CHECKLIST

## D-1 Order of work (do not reorder — later phases depend on earlier ones)
1. **Phase 0 — Safety:** branch `feat/makeover`, tag `pre-makeover`, lint + type-check wired, `src/utils/log.ts`.
2. **Phase 1 — Auth & tokens (A10, A11-1):** unblocks every user-bound API (this is your #1 pain: stats/playlists/account).
3. **Phase 2 — Player core (A01-A05, A12, A17, B-3):** native queue editing, progress events, native tracking.
4. **Phase 3 — Network / offline / downloads (A06, A07, A15).**
5. **Phase 4 — Launch & splash (A08).**
6. **Phase 5 — Design foundation (C-1 → C-7):** tokens, fonts, theme switch, `ui/` components, routing shell + the tab animation.
7. **Phase 6 — Screens (C-8)** in this order: Splash → Welcome → Login/Register → Forgot/Reset → Onboarding → Home → Search → Library/Downloads → Album/Artist/Playlist → Stats → Profile/Settings → Offline/NotFound → overlays.
8. **Phase 7 — FullPlayer gestures (FEATURE-01) + lyrics fixes (A14).**
9. **Phase 8 — Performance (Part B) + full QA matrix.**

> After **each** phase: `npm run lint` → `npx tsc -b` → `npm run build` → `npm run android` → install on a device → run that phase's acceptance tests → tick this file → commit `phase-N: …`.

## D-2 Device test matrix
Android 8 (API 26) · 11 (30) · 13 (33) · 14 (34) · 15 (35) — small 360×640 · normal 393×851 · tall 412×915 · tablet — light + dark + system — online / airplane / flaky (Android Studio network throttling) — gesture nav and 3-button nav — screen-off playback for 10 min — Telugu titles everywhere.

## D-3 Global acceptance criteria (the job is "done" only when ALL are true)
1. **No refresh-token code remains**; the token never expires; Stats / Playlists / Profile / Tracking work for days without re-login.
2. Play next / add to queue works from **any** album, playlist, search, artist, library list **and never restarts the current song**.
3. The progress bar and the counter are always in sync; no sweep-back on a song change or a loop.
4. Nav + mini player appear on every in-app screen **except** splash/auth/onboarding/player, with the correct tab highlighted.
5. Offline cold start → Downloads; online → Home; downloaded songs play with no network.
6. Launch shows exactly **one** splash (the Vinaraa mark) on Android 8 → 15, no icon-in-circle flash, no white frame.
7. Every screen follows the 25/75 rule, has all 4 states, supports light/dark/system and meets C-10.
8. Tab switching and page opening use the "grow from the tapped tab/card" animation at 60 fps.
9. Initial JS < 250 KB gz; cold start to interactive < 2 s on a mid-range phone (warm server).
10. The audio bytes never pass through Render during normal playback or downloads (§A15).

## D-4 MASTER CHECKLIST — tick `[x]` as you go (Antigravity: update this file in the repo)

### Phase 0 — Safety & setup
- [ ] D0-1 Branch `feat/makeover` created and tagged `pre-makeover`
- [ ] D0-2 `src/utils/log.ts` (no-op in production) added; noisy `console.log`s replaced
- [ ] D0-3 `.env.example` (`VITE_API_BASE_URL`, `VITE_ONESIGNAL_APP_ID`) + hard-coded IDs moved
- [ ] D0-4 `index.html` title/lang/viewport/theme-color fixed
- [ ] D0-5 New deps installed (B-2-3)
- [ ] D0-6 Unused deps removed (`depcheck` output pasted)

### Phase 1 — Auth, tokens, stats access
- [ ] D1-1 Stored JWT decoded; `GET /users/me` called; the `error.code` recorded in the PR
- [ ] D1-2 Render dashboard: `ACCESS_TOKEN_TTL` deleted; `JWT_ACCESS_SECRET` fixed and never regenerated
- [ ] D1-3 `signAccessToken` without `expiresIn`; `issueToken` replaces `issueTokenPair`
- [ ] D1-4 `rotate` / `revokeAllForUser` / `revokeDevice` / `listActiveSessions` deleted
- [ ] D1-5 `POST /auth/refresh` deleted; `/auth/logout` is a no-op; `sessions()` returns devices
- [ ] D1-6 `models/RefreshToken.js` deleted + all imports cleared + `scripts/drop-refresh-tokens.js`
- [ ] D1-7 `JWT_REFRESH_SECRET` / `REFRESH_TOKEN_TTL_DAYS` / `ACCESS_TOKEN_TTL` removed from `env.js`, `render.yaml`, README, Postman, `routes/index.js`
- [ ] D1-8 Production refuses to boot without a real `JWT_ACCESS_SECRET`
- [ ] D1-9 `tokenVersion` bumped **only** by change-password / reset-password / explicit log-out-everywhere
- [ ] D1-10 `optionalAuth` sets `X-Auth-State: invalid`
- [ ] D1-11 App: refresh logic deleted from `client.ts`
- [ ] D1-12 App: 401 → logout **once** only for `TOKEN_INVALID` / `SESSION_REVOKED` / `USER_NOT_FOUND`; never on network/5xx/429
- [ ] D1-13 App: `setAuth({accessToken})` only — no `refreshToken` anywhere (`auth.ts`, `native/player.ts`, `playerWebStub.ts`, `VinaraaPlayerPlugin.kt`)
- [ ] D1-14 App: `checkAuth()` validates once with `users.me()` when online; stays logged in offline
- [ ] D1-15 App: token in `EncryptedSharedPreferences`; `android:allowBackup="false"`
- [ ] D1-16 `grep -rni refresh app/src app/android` shows no token-related hits
- [ ] D1-17 TEST: device date +400 days → Stats/Playlists/Profile load without re-login
- [ ] D1-18 TEST: `POST /auth/refresh` → 404

### Phase 2 — Player core
- [ ] D2-1 `ensurePlayable()` used by every enqueue path
- [ ] D2-2 Native `insertNext` / `appendItems` / `removeAt` / `moveItem` / `skipToIndex` / `setShuffle` / `getQueue` / `clear` / `appReady` / `setPlaybackContext`
- [ ] D2-3 `playNext` / `appendToQueue` use native edits; de-dupe by move; toast + Undo
- [ ] D2-4 `queueVersion` rebuild rule (never on length)
- [ ] D2-5 Next/Prev → native; `songChanged` drives the store
- [ ] D2-6 Native shuffle replaces JS random
- [ ] D2-7 Prefetch only on `songChanged`, guarded + backed off, queue capped at 200
- [ ] D2-8 Cold-start `nativeLoaded` path
- [ ] D2-9 Kotlin events via main `Handler`; reconcile on foreground
- [ ] D2-10 Error handling: ≤ 3 consecutive errors then stop + Retry
- [ ] D2-11 `history` array + duplicate open-player listener deleted
- [ ] D2-12 Native `progress` event (500 ms) with `songId`/`index`/`positionMs`/`durationMs`
- [ ] D2-13 `songChanged` always resets position/duration + bumps `epoch` (incl. repeat-one)
- [ ] D2-14 `store/progress.ts` created; position out of the main store + persistence
- [ ] D2-15 MiniPlayer bar: `scaleX`, no transition, `key={epoch}`
- [ ] D2-16 Selectors + `React.memo` rows + virtualisation
- [ ] D2-17 Back-button chain: sheet → player → home → minimise; `showPlayer` derived from the route
- [ ] D2-18 `App.tsx` effects split; OneSignal once; permission in context
- [ ] D2-19 `PlaybackService` hardened (B-3, incl. release order)
- [ ] D2-20 Native `TrackingClient` (start / 12 s heartbeat / pause / seek / end / offline queue + `/tracking/sync`)
- [ ] D2-21 All JS tracking deleted from `engine.ts` and `FullPlayer.tsx`
- [ ] D2-22 `Stats.tsx` 4 states incl. real error + Retry; refetch on focus/online; pull-to-refresh
- [ ] D2-23 TEST: play next from album → playlist → search → artist, no restart
- [ ] D2-24 TEST: repeat-one shows bar 0 instantly; 10× fast Next never shows old progress
- [ ] D2-25 TEST: 2 min screen-off listening counted in Stats
- [ ] D2-26 TEST: shuffle + natural advance is random; notification next/prev matches the in-app title

### Phase 3 — Network, offline, downloads
- [ ] D3-1 `useNetwork` store (`@capacitor/network`) + `serverState` via `/health`
- [ ] D3-2 Boot routing: no token → welcome; online → home; offline → downloads
- [ ] D3-3 `/downloads` route created; `Offline.tsx` fixed; `NetworkBanner` built
- [ ] D3-4 Offline UI states (dimmed nav items, toasts, cached data)
- [ ] D3-5 API client: 20 s timeout, GET retries with back-off, in-flight dedupe, search abort
- [ ] D3-6 Native downloader (WorkManager + OkHttp, app-specific storage, `{songId}.m4a`, `.part` + rename, progress events, cancel, delete, list, storageInfo)
- [ ] D3-7 Cover art cached for offline
- [ ] D3-8 `store/downloads.ts` (idb) with queued/downloading/done/failed + reconciliation
- [ ] D3-9 `ensurePlayable` prefers the local file; offline queue plays local only
- [ ] D3-10 Stateful `DownloadButton` in sheet, rows, album/playlist "Download all"
- [ ] D3-11 Settings → Downloads (Wi-Fi only, quality, storage, delete all)
- [ ] D3-12 Manifest storage permissions removed; `FOREGROUND_SERVICE_DATA_SYNC` + `WAKE_LOCK` added
- [ ] D3-13 TEST: Telugu download plays in airplane mode after a restart
- [ ] D3-14 TEST: failed download shows retry; notification shows progress
- [ ] D3-15 TEST: no `/music/stream/` traffic during normal playback (bandwidth budget safe)

### Phase 4 — Launch & splash
- [ ] D4-1 Adaptive + monochrome launcher icon wired; `@drawable/vinaraa` removed from the manifest
- [ ] D4-2 `ic_splash_logo` in the safe zone; `AppTheme.Splash` with animated icon + `postSplashScreenTheme`
- [ ] D4-3 `installSplashScreen()` + `setKeepOnScreenCondition` + `appReady()` from JS
- [ ] D4-4 `values` / `values-night` splash colours
- [ ] D4-5 `capacitor.config.ts` SplashScreen block resolved
- [ ] D4-6 `index.html` inline background + no-flash theme script
- [ ] D4-7 Web Splash: no fake 1200 ms delay; identical first frame; cross-fade/expand out
- [ ] D4-8 TEST on Android 8 / 11 / 12 / 13 / 14 / 15 — one identical splash

### Phase 5 — Design foundation
- [ ] D5-1 `@theme` tokens (C-2); `tailwind.config.js`, `@config` and the manual shims deleted
- [ ] D5-2 Every hard-coded hex removed from components **and** recharts
- [ ] D5-3 Fonts: Plus Jakarta Sans variable + Noto Sans Telugu; Sora removed; type scale utilities
- [ ] D5-4 `store/settings.ts` + theme switch + no-flash script + StatusBar/navigation-bar sync (DayNight native parent, B-2-9)
- [ ] D5-5 `src/ui/`: Button, IconButton, Chip/Segmented, Input, Card, ArtistCircle, SongRow, NowPlayingBars, ActionSheet, Toast (bottom), Skeleton, EmptyState, ErrorState, ProgressRing, NetworkBanner, TopLoadingBar, Avatar, Switch, Slider
- [ ] D5-6 `routes.ts` chrome table + `AppShell` layout route
- [ ] D5-7 Active tab derived from the URL; re-tap = scroll top / pop to root
- [ ] D5-8 Floating-pill BottomNav with the gradient active pill, haptics, keyboard-aware hide
- [ ] D5-9 New MiniPlayer (top progress line, swipe gestures, shared artwork `layoutId`)
- [ ] D5-10 Tab "grow-from-icon" transition incl. the delayed chrome fade-in + keep-alive tabs
- [ ] D5-11 Detail-page shared-element transition + edge-swipe back
- [ ] D5-12 Sheet component with drag-to-dismiss; back closes sheets
- [ ] D5-13 `--bottom-chrome` variable; `.pb-safe` replaced everywhere
- [ ] D5-14 Reduced-motion + haptics wiring
- [ ] D5-15 TEST: tab switch ≈ 360 ms at 60 fps with no blank frame; light/dark/system switches instantly with no flash

### Phase 6 — Screens (C-8)
- [ ] D6-1 Splash · D6-2 Welcome · D6-3 Login/Register · D6-4 Forgot/Reset · D6-5 Onboarding
- [ ] D6-6 Home (compact header, continue listening, quick picks, hero, rails, chips, per-rail errors)
- [ ] D6-7 Search (bottom field, recent preview cards + backend support, grouped results, states)
- [ ] D6-8 Library (segments, mosaic rows, FAB sheet, liked, downloads)
- [ ] D6-9 Downloads / offline home
- [ ] D6-10 Stats (hero metric, tokens chart, top lists, insights, error ≠ empty)
- [ ] D6-11 Album / Artist / Playlist with the sticky thumb-zone action bar + **nav visible**
- [ ] D6-12 Profile + Settings (all groups, theme control, optimistic saves, logout sheet)
- [ ] D6-13 Offline + NotFound
- [ ] D6-14 Queue sheet (native reorder/remove), add-to-playlist sheet, permission pre-prompt
- [ ] D6-15 `NowPlayingBars` on the current song in **every** list + mini player + playlist cards
- [ ] D6-16 Duplicate `<MiniPlayer/>` removed from Search/Artist/Stats
- [ ] D6-17 All emoji removed; Lucide-only icons
- [ ] D6-18 Copy pass: sentence case, active verbs, errors = what + how to fix
- [ ] D6-19 25/75 audit: screenshot each screen and mark the top-25 % zone

### Phase 7 — FullPlayer logic only
- [ ] D7-1 Gestures per FEATURE-01 (art → lyrics, controls → info, down → minimise, left/right → prev/next)
- [ ] D7-2 Slider excluded from swipe; haptics; hardware-back order
- [ ] D7-3 Lyrics reset + cache per song; `AbortController`; better matching
- [ ] D7-4 **FullPlayer visuals untouched** (screenshot diff proves it)

### Phase 8 — Performance & release
- [ ] D8-1 Route-level `React.lazy`; recharts only on Stats; manual chunks; `console` dropped in prod
- [ ] D8-2 React Query everywhere + persisted cache
- [ ] D8-3 Image sizing helper, lazy images, placeholders
- [ ] D8-4 Blur limited to nav + mini player; no `transition-all`; shimmer via `transform`
- [ ] D8-5 Virtualisation on long lists
- [ ] D8-6 Release build: `minifyEnabled`, `shrinkResources`, keep rules, AAB, Media3 upgraded
- [ ] D8-7 Render keep-alive cron + cache headers verified
- [ ] D8-8 Manifest hardening (`adjustResize`, predictive back, `allowBackup=false`, cleartext off)
- [ ] D8-9 Full device-matrix QA (D-2) + every criterion in D-3 green
- [ ] D8-10 `README.md` updated with build/run steps, env vars and the final architecture

---

## Appendix A — Citation index (every file referenced above exists in the clone)

**App:** `app/index.html` · `app/capacitor.config.ts` · `app/tailwind.config.js` · `app/postcss.config.js` · `app/vite.config.ts` · `app/tsconfig.app.json` · `app/package.json` · `app/src/index.css` · `app/src/main.tsx` · `app/src/App.tsx` · `app/src/motion.ts` · `app/src/navigation/Navigator.tsx` · `app/src/api/client.ts` · `app/src/api/endpoints.ts` · `app/src/store/{player,auth,ui}.ts` · `app/src/player/engine.ts` · `app/src/native/{player.ts,playerWebStub.ts}` · `app/src/utils/{song,image,device,offline}.ts` · `app/src/components/{BottomNav,MiniPlayer,QueueSheet,SongActionSheet,SongRow,Toast,Skeleton,Marquee}.tsx` · `app/src/screens/{Splash,Welcome,Login,Register,ForgotPassword,ResetPassword,Onboarding,Home,Search,Library,Stats,Album,Artist,PlaylistPage,FullPlayer,Profile,Settings,Offline,NotFound}.tsx`
**Android:** `app/android/app/src/main/AndroidManifest.xml` · `.../res/values/{styles,strings}.xml` · `.../res/mipmap-anydpi-v26/{ic_launcher,ic_launcher_round}.xml` · `.../res/drawable/{vinaraa.png,splash.png}` · `.../java/com/music/vinaraa/{MainActivity,VinaraaPlayerPlugin,PlaybackService}.kt` · `app/android/app/build.gradle` · `app/android/variables.gradle`
**Backend:** `soundwave-backend/src/{app,server}.js` · `src/config/{env,db}.js` · `src/middleware/auth.js` · `src/models/{RefreshToken,Song,Entity,Playlist,PlayEvent,ListeningSession,SearchHistory,DailyStat,CacheEntry,User,Upstream}.js` · `src/routes/{index,auth,user,music,playlist,tracking,stats,recommendation,onboarding,notification,admin,health}.routes.js` · `src/services/{tokenService,authService,catalog,playlistService,trackingService,statsService,recommendationService,tasteService,saavnClient,upstreamPool,cache}.js` · `src/validators/schemas.js` · `scripts/{keepalive,ensure-indexes,seed-upstreams,smoke-test}.js` · `render.yaml`

> **Not found in the code (do not "fix" these):** a dead `ACTION_NEXT/ACTION_PREVIOUS` receiver (9.14 — retracted), a `/downloads` route (it must be *created*), any OAuth/social-login endpoint, any "clicked entity" search-history record, any `useQuery` usage, any service worker.

## Appendix B — Answers to your open questions
1. **"Is the audio really coming straight from JioSaavn's CDN?"** Yes — `audio.best` is the direct `aac.saavncdn.com` URL (`catalog.js:159-172`) and `formatPlayerSong` uses it first (`utils/song.ts:17-21`). Keep that invariant and Render's 5 GB is safe. New rule: downloads must also use the CDN URL, and the `/music/stream` proxy must default to a 302 redirect (§A15).
2. **"Do all requests come from Cloudflare?"** No — the app talks to Render, Render talks to the Cloudflare Worker (`client.ts:6`, `render.yaml`). Cloudflare only fronts the JioSaavn scrape.
3. **"Does the existing instruction file solve everything?"** No. It is a solid 80 % skeleton, but it has 3 factual errors (§0.4), misses 14 code-level causes including the exact 401 mechanism (§0.5), never mentions the bandwidth contract that decides how streaming and downloads must be built (§A15), and leaves two of your explicit asks uncovered: the Search "last 8 preview cards with correct tap routing" needs **new local + backend plumbing** (N-10), and a light theme is **impossible** until the native theme parent becomes DayNight (N-12). Everything above is the corrected, expanded, tick-boxed version.

