# SoundWave Backend

Production-grade **Node.js + Express + MongoDB Atlas** backend for the SoundWave Android music app.
It is the load-balancing layer in front of your JioSaavn API worker — so a worker URL that expires or
dies never breaks the app — plus accounts, playlists, seek-proof listening tracking, analytics and the
movie → hero → language → singer → music-director recommendation engine.

**No Redis.** Caching is a two-tier stack (in-process LRU + MongoDB TTL collections).

---

## Why this exists (the problem it solves)

You said the main issue is: *"my worker URL will expire, so something has to fix that."*

Upstream hosts are **data, not code**. They live in MongoDB, are seeded from `UPSTREAM_URLS`, and are
managed at runtime:

```
POST   /api/v1/admin/upstreams            add a new worker URL  (probed immediately)
PATCH  /api/v1/admin/upstreams/:id        enable/disable, change priority
DELETE /api/v1/admin/upstreams/:id        retire a dead host
POST   /api/v1/admin/upstreams/health-check   probe every host
POST   /api/v1/admin/upstreams/optimize       re-order by measured latency
```

Requests walk the pool in priority order with failover. A host that fails 3 times in a row enters a
cooldown and is skipped. If every host fails, responses are served from cache — including **stale**
cache (stale-while-revalidate), so the app stays browsable while you rotate URLs. No redeploy, no app update.

---

## Requirements

- Node.js **20+**
- MongoDB Atlas (free **M0** is enough) or a local MongoDB

## Quick start

```bash
npm install
cp .env.example .env          # then edit it
node scripts/ensure-indexes.js   # build indexes (incl. TTL retention indexes)
npm start                     # http://localhost:8080
npm run smoke                 # end-to-end test suite (in-memory Mongo, hits the live worker)
```

`npm run smoke` boots the real app against `mongodb-memory-server` and runs ~95 checks across auth,
onboarding, search, playlists, tracking, analytics, recommendations and admin. It also calls your live
worker, so a green run proves the upstream contract still matches.

## Environment

Everything is in `.env.example`. The values that matter most:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing keys — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_API_KEY` | Protects `/api/v1/admin/*` (rotating worker URLs) |
| `UPSTREAM_URLS` | Your JioSaavn worker(s), comma separated |
| `UPSTREAM_PATH_PREFIX` | **`/api`** for this worker — your worker returns `route not found` without it |
| `UPSTREAM_FALLBACK_URLS` | Optional public mirrors, used only when all your own hosts are down |
| `RECO_W_*` | Recommendation weights: movie 0.30, hero 0.22, language 0.18, singer 0.16, director 0.14 |
| `CACHE_TTL_*`, `*_RATE_LIMIT_*` | Caching and throttling knobs |
| `TTL_*_DAYS` | Retention for raw events / history / sessions / cache |
| `PUBLIC_BASE_URL` | Lets the server self-ping `/health` every 10 min so Render's free tier does not cold-start |

The server refuses to boot in production with default dev secrets (`env.assertProductionSecrets()`).

## Deploy

**Render (recommended — Express + Mongoose need a long-running Node process; Cloudflare Workers cannot
run this).** `render.yaml` is included; set the secret env vars in the dashboard (or use Blueprint deploy).
`render.yaml` pins `healthCheckPath: /health`, and the keep-alive ping keeps the free instance warm.

**Docker / anywhere else:** `docker compose up` (bundles MongoDB), or build the included `Dockerfile`.

---

## API surface

Base: `/api/v1` (the shorter `/api` alias also works). Everything returns one envelope:
`{ success, data, meta? }` on success and `{ success:false, error:{ code, message, details? } }` on failure.

### Health
```
GET /health                     liveness + uptime
GET /health/ready               readiness (DB connected)
GET /health/diagnostics         DB + cache + upstream pool + memory
GET /health/upstream            probe every upstream host
GET /health/upstream/search     prove a real search works right now
GET /api/v1                     machine-readable route map
```

### Auth (`/auth`)
```
POST   /register                email+password+device → access token (never expires)
POST   /login
POST   /logout                  client-side only clear
POST   /logout-all              revoke everything (bumps tokenVersion)
POST   /change-password         verifies current password, revokes all sessions
POST   /forgot-password         neutral response (no account enumeration)
POST   /reset-password
GET    /sessions                active tokens + known devices
DELETE /sessions/:deviceId      remote "log out that phone"
```

### User (`/users`) — all JWT-protected
```
GET    /me                      profile + taste summary + history depth
PATCH  /me
PATCH  /me/preferences          languages, audioQuality, autoplay, crossfade, dataSaver…
PUT    /me/taste-seeds          replace taste seeds in one shot
POST   /me/devices              register device + FCM token
GET    /me/search-history       POST to record, DELETE to clear all / one
GET    /me/export               full data export (GDPR)
DELETE /me                      close account (send {"confirm":"DELETE"})
```

### Onboarding (`/onboarding`)
```
GET  /bundle?language=hindi     ALL steps in one request: languages, movies, actors, singers, directors
GET  /options?type=singers&language=hindi&q=arijit
GET  /languages   GET /status
POST /complete                  seeds taste → creates system playlists → fills "Your Taste Mix"
```

### Music (`/music`) — the proxy layer
```
GET /search?q=&type=all|songs|albums|artists|playlists&page=&limit=&language=
GET /search/suggestions?q=           local-first type-ahead (works offline)
GET /songs/:id                       normalised song (artwork sizes, quality ladder, entities)
GET /songs?ids=a,b,c                 bulk
GET /songs/:id/lyrics   GET /songs/:id/similar
GET /albums/:id   GET /artists/:id   GET /editorial/playlists/:id
GET /modules?languages=hindi,punjabi   GET /trending   GET /languages
GET /stream/:id?mode=proxy|redirect&quality=320kbps    AUTH REQUIRED
```

`stream` with `mode=redirect` issues a 302 to the CDN (cheapest). With `mode=proxy` the backend streams
the bytes and forwards `Range` headers so ExoPlayer can seek, while hiding the real CDN URL.

### Playlists (`/playlists`)
```
GET/POST   /
GET/PATCH/DELETE /:id
POST   /:id/tracks      DELETE /:id/tracks      PATCH /:id/reorder
POST   /save-song                the "Save to playlist" bottom sheet flow
GET    /name-suggestion          prefills "Playlist 1", "Playlist 2"…
POST   /liked                    like/unlike (omit `liked` to toggle)
GET    /liked/:songId            is-liked check
GET    /system                   Liked Songs, On Repeat, Your Taste Mix, Recently Added
POST   /system/taste-mix/refresh   POST /system/on-repeat/refresh
POST   /:id/duplicate   POST /:id/play   GET /public
```

**Save behaviour you asked for:** creating a playlist with no name auto-names it `Playlist N` from the
user's lifetime counter (checked against live names, with a 409-retry so two simultaneous saves can't collide).

### Tracking (`/tracking`) — seek-proof listening time
```
POST /sessions                    open a session with a songId
POST /sessions/:id/heartbeat      { positionMs, state }  every 10–15 s
POST /sessions/:id/end            { positionMs }
POST /sessions/:id/events         like / skip / queue_add / seek / pause…
POST /sync                        offline-first batch flush from the app
GET  /sessions/active             resume state
```

**How the time maths works.** The client reports only the playhead; the server decides what was heard:

| Situation | Credited |
| --- | --- |
| `advance ≤ elapsed + 2.5 s` while `state=playing` | the real advance |
| state is `paused` / `buffering` | 0 |
| `advance ≤ 0` (replay, stall, duplicate delivery) | 0 |
| `advance > elapsed + 2.5 s` (jumped to middle/end) | **0**, flagged as a seek |
| client asleep > 10 min | capped at 5 min |

So skipping to the end counts as ~0 s, exactly as you asked. `POST /stats/verify-tracking` lets you feed a
synthetic timeline and see the credited milliseconds.

### Recommendations (`/recommendations`)
```
GET /feed                        several explained rails in one request
GET /for-you?limit=&language=    ranked items, each with matchPercent + per-dimension explain
GET /next?currentSongId=         autoplay: same movie → hero/singer/director cluster → personal ranking
GET /radio?songId=|entityId=&entityType=
GET /entity/:type/:id            artist|musicDirector|actor|album — with your affinity %
GET /taste-profile               your weighted profile, explained
```

Score = `0.30·movie + 0.22·hero(actor) + 0.18·language + 0.16·singer + 0.14·musicDirector
+ popularity − repetition penalty`, computed from measured listening time (not play counts, so skips
barely register) blended with explicit onboarding picks. Every item ships an explain block:

```json
{ "matchPercent": 92,
  "explain": { "movie": 100, "hero": 80, "language": 100, "singer": 60, "director": 45,
               "matched": { "movie": "Brahmastra", "hero": "Ranbir Kapoor", "singer": "Arijit Singh" } },
  "reason": "Because you like from Brahmastra and starring Ranbir Kapoor" }
```

**On mood tags (sad / love / romance):** the JioSaavn API does not expose them anywhere — I checked the
live payloads. There is no field to read, so they were deliberately left out and the entity graph is used
instead, per your instruction.

### Stats (`/stats`)
```
GET /dashboard?range=   EVERYTHING in one request: overview, top songs/movies/singers/directors/actors/languages,
                        timeline, 7×24 heatmap, listening quality, recently played
GET /overview /top?type= /timeline /heatmap /quality /insights /recently-played
GET /history            raw events (paginated)
GET /history/sessions   per-track measured time, completeness, seek counts
POST /verify-tracking   prove the seek guard to yourself
```
Ranges: `24h | 7d | 30d | 90d | 180d | all`. Insights are written sentences ready to render as cards
("You listened for 42h 10m in the last 30 days — about 1h 24m a day").

### Notifications (`/notifications`)
Device/push-token registry, per-device opt-out, live-activity opt-in, and a test endpoint. It returns an
**honest** `{ sent:false, reason:"push_provider_not_configured" }` until you add `firebase-admin`
(one file: `deliverPush()` in `src/routes/notification.routes.js`).

> The lock-screen / status-bar / Samsung Now Bar controls come from the Android **Media3 MediaSession +
> MediaStyle notification**, not from this API. Send title, artist, artwork, duration and position to
> Media3 and the OS draws the island.

### Admin (`/admin`, header `x-admin-key: <ADMIN_API_KEY>`)
Upstream management (above), plus:
```
GET  /stats   /users
POST /maintenance/ensure-indexes
POST /maintenance/sweep-cache          /refresh-cache
POST /maintenance/reap-stale-sessions  closes sessions left open by a killed app
POST /maintenance/refresh-catalogue    /rebuild-system-playlists   /recompute-trending
```

---

## Architecture

```
Android app
    │  JWT bearer
    ▼
Express API  ──►  Mongo Atlas  (users, playlists, catalogue, events, rollups, cache tier 2)
    │                 ▲
    │                 └── two-tier cache: in-process LRU (hot) + TTL collection (persists cold starts)
    ▼
Upstream pool (Mongo)  ──►  priority order + failover + cooldown
    ├── https://jiosaavn-api.apicoolie.workers.dev   (/api prefix)
    ├── <your next worker>        ← add at runtime, no deploy
    └── public mirrors (optional, used only if every own host is down)
```

```
src/
├── app.js  server.js              Express wiring, boot, graceful shutdown, background jobs
├── config/     env.js  db.js
├── middleware/ auth.js (JWT)  errors.js  rateLimit.js  validate.js (zod)  requestContext.js
├── models/     User Upstream Song Entity Playlist PlayEvent ListeningSession
│               DailyStat SearchHistory CacheEntry RefreshToken
├── services/   upstreamPool.js  ← the load balancer
│               saavnClient.js   ← HTTP + failover + timeouts
│               catalog.js       ← normalisation + persistence (catalogue survives URL rotation)
│               authService tokenService playlistService
│               trackingService  ← seek-proof time maths
│               tasteService  recommendationService  statsService  cache.js
└── routes/     health auth users onboarding music playlists tracking
                recommendations stats notification admin
scripts/  smoke-test.js  seed-upstreams.js  ensure-indexes.js  keepalive.js
postman/  SoundWave.postman_collection.json   (every route, with test scripts that capture tokens)
```

## Security

- **Tokens never expire; revoke everyone by changing your password.** There are no refresh tokens; a single JWT access token is used, and it is validated against the user's `tokenVersion`.
- bcrypt password hashing (configurable rounds), account lockout after 8 failed logins.
- `tokenVersion` invalidates every issued access token on password change / logout-all.
- `helmet`, CORS allow-list, `hpp` parameter-pollution guard, per-user/per-IP rate limits on global,
  auth, write and upstream routes.
- What is **not** trusted (a real bug found by testing, documented in `src/config/db.js`): Mongoose's
  global `sanitizeFilter` breaks legitimate operator queries, so injection defence is layered instead —
  zod schemas strip unknown keys, ids are regex-validated, and every `$in`/`$gt` in a query is written by
  our code, never taken from input.
- Centralised error handler: no stack traces or internals leak in production.

## Notes and limitations

- **Cloudflare Workers cannot host this** — Express + Mongoose need a long-running Node process. Use Render,
  Railway, Fly.io, a VPS, or the Docker image. Your *JioSaavn proxy* stays on Cloudflare Workers; this
  backend is what talks to it.
- `GET /music/artists/:id` degrades to the local catalogue because your worker returns malformed text for
  some artist ids — the endpoint never 500s.
- `/songs?id=a,b` on your worker returns only the first id, so bulk fetch fans out to `/songs/:id` in parallel.
- Offline-synced sessions can't be verified server-side, so their time is clamped to the track duration and
  tagged `source: "offline"`; only trusted online tracking drives recommendations.
- Uploads (custom playlist artwork) are not implemented — there is no image host configured yet.
- Push delivery needs `firebase-admin`; the registry and preferences are already in place.

## License

MIT. This backend is a wrapper around an unofficial JioSaavn API; respect the upstream project's terms and
your local copyright rules.
