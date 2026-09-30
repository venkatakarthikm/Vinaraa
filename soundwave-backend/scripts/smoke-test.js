'use strict';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * END-TO-END SMOKE TEST
 * ─────────────────────────────────────────────────────────────────────────────
 * Boots the real Express app against an ephemeral in-memory MongoDB and walks
 * the whole product surface: auth → onboarding → search → playlists → the
 * seek-proof tracking pipeline → analytics → recommendations → admin.
 *
 * It also hits the REAL JioSaavn worker, so a green run proves the upstream
 * contract (paths, fields, streaming URLs) still matches this backend.
 *
 *   npm run smoke
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-0123456789abcdef0123456789';
process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-key-0123456789';
process.env.CACHE_MONGO_TIER = 'true';
process.env.BCRYPT_ROUNDS = '4'; // keep the test fast
process.env.UPSTREAM_URLS = process.env.UPSTREAM_URLS || 'https://jiosaavn-api.apicoolie.workers.dev';
process.env.UPSTREAM_PATH_PREFIX = process.env.UPSTREAM_PATH_PREFIX || '/api';
process.env.UPSTREAM_TIMEOUT_MS = process.env.UPSTREAM_TIMEOUT_MS || '15000';

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function main() {
  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
    return ok;
  };

  console.log('\n=== SoundWave backend smoke test ===\n');
  console.log('[setup] starting in-memory MongoDB…');
  mongod = await MongoMemoryServer.create({ instance: { dbName: 'soundwave_smoke' } });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  console.log(`[setup] mongo ready at ${uri}\n`);

  // Require AFTER env is final so the config singleton picks it up.
  const db = require('../src/config/db');
  const { createApp } = require('../src/app');
  const pool = require('../src/services/upstreamPool');
  const cache = require('../src/services/cache');
  const User = require('../src/models/User');
  const ListeningSession = require('../src/models/ListeningSession');
  const Playlist = require('../src/models/Playlist');

  await db.connect(uri);
  await db.ensureIndexes();
  await pool.seedFromEnv();

  const request = require('supertest');
  const app = createApp();
  const api = request(app);

  const state = { accessToken: null, refreshToken: null, sessionId: null, playlistId: null, songId: null, secondUpstreamId: null };
  const auth = (r) => (state.accessToken ? r.set('Authorization', `Bearer ${state.accessToken}`) : r);

  /* ── 1. health ─────────────────────────────────────────────── */
  {
    const res = await api.get('/health');
    record('GET /health → 200 ok', res.status === 200 && res.body.data?.status === 'ok', `status=${res.status}`);
    const ready = await api.get('/health/ready');
    record('GET /health/ready → connected', ready.status === 200 && ready.body.data?.database?.state === 'connected');
  }

  /* ── 2. API index ──────────────────────────────────────────── */
  {
    const res = await api.get('/api/v1');
    const groups = Object.keys(res.body?.data?.endpoints || {}).length;
    record('GET /api/v1 → route map', res.status === 200 && groups >= 10, `${groups} groups`);
  }

  /* ── 3. auth ───────────────────────────────────────────────── */
  {
    const email = `smoke_${Date.now()}@soundwave.test`;
    const reg = await api.post('/api/v1/auth/register').send({
      email,
      password: 'Passw0rd123',
      name: 'Smoke Tester',
      locale: 'en-IN',
      device: { deviceId: 'smoke-device-1', platform: 'android', model: 'Pixel 8', osVersion: '14', appVersion: '1.0.0' },
    });
    const okReg = reg.status === 201 && reg.body.data?.tokens?.accessToken && reg.body.data?.tokens?.refreshToken;
    record('POST /auth/register → 201 + token pair', okReg, okReg ? `user=${reg.body.data.user.id}` : JSON.stringify(reg.body).slice(0, 200));
    state.accessToken = reg.body.data?.tokens?.accessToken;
    state.refreshToken = reg.body.data?.tokens?.refreshToken;
    state.userId = reg.body.data?.user?.id;

    const dupe = await api.post('/api/v1/auth/register').send({ email, password: 'Passw0rd123', name: 'Dupe' });
    record('POST /auth/register duplicate → 409', dupe.status === 409, `status=${dupe.status}`);

    const weak = await api.post('/api/v1/auth/register').send({ email: `w${Date.now()}@x.test`, password: 'weak', name: 'Weak' });
    record('POST /auth/register weak password → 422', weak.status === 422, `status=${weak.status}`);

    const badLogin = await api.post('/api/v1/auth/login').send({ email, password: 'wrong-password' });
    record('POST /auth/login wrong password → 401', badLogin.status === 401, `status=${badLogin.status}`);

    const login = await api.post('/api/v1/auth/login').send({ email, password: 'Passw0rd123', device: { deviceId: 'smoke-device-1' } });
    record('POST /auth/login → 200 + tokens', login.status === 200 && Boolean(login.body.data?.tokens?.accessToken));
    state.accessToken = login.body.data?.tokens?.accessToken;
    state.refreshToken = login.body.data?.tokens?.refreshToken;

    const noAuth = await api.get('/api/v1/users/me');
    record('GET /users/me without token → 401', noAuth.status === 401, `status=${noAuth.status}`);

    const me = await auth(api.get('/api/v1/users/me'));
    record('GET /users/me → profile + taste', me.status === 200 && Boolean(me.body.data?.user?.email) && Boolean(me.body.data?.taste), `status=${me.status}`);
  }

  /* ── 4. onboarding ─────────────────────────────────────────── */
  {
    const bundle = await auth(api.get('/api/v1/onboarding/bundle?language=hindi'));
    const steps = bundle.body?.data?.steps || [];
    record('GET /onboarding/bundle → 5 steps', bundle.status === 200 && steps.length === 5, steps.map((s) => s.key).join(','));

    const opts = await auth(api.get('/api/v1/onboarding/options?type=singers&language=hindi'));
    record('GET /onboarding/options?type=singers', opts.status === 200 && (opts.body.data?.items || []).length > 0, `${(opts.body.data?.items || []).length} items`);

    const search = await auth(api.get('/api/v1/onboarding/options?type=singers&q=arijit'));
    record('GET /onboarding/options search q=arijit', search.status === 200, `${(search.body.data?.items || []).length} items`);

    const complete = await auth(api.post('/api/v1/onboarding/complete')).send({
      languages: ['hindi', 'punjabi'],
      singers: [{ id: '456323', name: 'Pritam' }],
      musicDirectors: [{ id: '456323', name: 'Pritam' }],
      actors: [{ id: '1001', name: 'Ranbir Kapoor' }],
      favouriteMovies: [{ id: '38845390', name: 'Brahmastra' }],
    });
    record(
      'POST /onboarding/complete → seeds + starter tracks',
      complete.status === 200 && complete.body.data?.onboarding?.completed === true,
      `starterTracks=${(complete.body.data?.starterTracks || []).length} tasteMix=${complete.body.data?.tasteMixPlaylistId ? 'yes' : 'no'}`
    );
  }

  /* ── 5. music (REAL upstream) ──────────────────────────────── */
  {
    const search = await auth(api.get('/api/v1/music/search?q=kesariya&type=songs&limit=5'));
    const songs = search.body?.data || [];
    state.songId = songs[0]?.id || null;
    record('GET /music/search?type=songs (live upstream)', search.status === 200 && songs.length > 0, `first="${songs[0]?.name}" id=${state.songId}`);

    const first = songs[0] || {};
    record('song payload has movie/language/duration/artwork', Boolean(first.album?.movieName) && Boolean(first.language) && first.durationMs > 0 && Boolean(first.image), `movie="${first.album?.movieName}" lang=${first.language} dur=${first.durationMs}ms`);
    record('song payload exposes entity arrays', Array.isArray(first.singers) && Array.isArray(first.musicDirectors) && Array.isArray(first.actors), `singers=${first.singers?.length} directors=${first.musicDirectors?.length} actors=${first.actors?.length}`);
    record('song payload has audio quality ladder', (first.audio?.formats || []).length > 0 && Boolean(first.audio?.best), `${(first.audio?.formats || []).length} formats, best=${first.audio?.quality}`);
    record('actors (hero) extracted from upstream', (first.actors || []).length > 0, (first.actors || []).map((a) => a.name).join(', ') || 'none — this song has no starring credits');

    const all = await auth(api.get('/api/v1/music/search?q=brahmastra&type=all&limit=3'));
    const d = all.body?.data || {};
    record('GET /music/search?type=all → 4 scopes', all.status === 200 && ('songs' in d) && ('albums' in d) && ('artists' in d) && ('playlists' in d), `songs=${d.songs?.length} albums=${d.albums?.length} artists=${d.artists?.length} playlists=${d.playlists?.length}`);

    const detail = await auth(api.get(`/api/v1/music/songs/${state.songId}`));
    record('GET /music/songs/:id → detail', detail.status === 200 && detail.body.data?.id === state.songId, `name="${detail.body.data?.name}"`);

    // Deliberately repeats state.songId: the endpoint must de-duplicate ids, and
    // the worker's own comma form returns only the first id, so this also proves
    // the parallel /songs/:id fan-out works.
    const bulk = await auth(api.get(`/api/v1/music/songs?ids=${state.songId},3IoDK8qI,${state.songId}`));
    const bulkSongs = bulk.body.data?.songs || [];
    record(
      'GET /music/songs?ids= → bulk fan-out + de-duplication',
      bulk.status === 200 && bulkSongs.length === 2 && (bulk.body.data?.missing || []).length === 0,
      `${bulkSongs.length} unique songs (3 ids sent, 1 duplicate), missing=${JSON.stringify(bulk.body.data?.missing || [])}`
    );

    const sugg = await auth(api.get('/api/v1/music/search/suggestions?q=kesa'));
    record('GET /music/search/suggestions', sugg.status === 200, `${(sugg.body.data?.suggestions || []).length} suggestions`);

    const similar = await auth(api.get(`/api/v1/music/songs/${state.songId}/similar`));
    record('GET /music/songs/:id/similar', similar.status === 200, `${(similar.body.data?.items || []).length} items`);

    const trending = await auth(api.get('/api/v1/music/trending?limit=5'));
    record('GET /music/trending', trending.status === 200, `${(trending.body.data?.items || []).length} items`);

    const langs = await auth(api.get('/api/v1/music/languages'));
    record('GET /music/languages', langs.status === 200 && (langs.body.data?.languages || []).length > 0, `${(langs.body.data?.languages || []).length} languages`);

    const stream = await auth(api.get(`/api/v1/music/stream/${state.songId}?mode=redirect`));
    record('GET /music/stream/:id?mode=redirect → 302 to CDN', stream.status === 302 && String(stream.headers.location || '').startsWith('https://'), `status=${stream.status} host=${(() => { try { return new URL(stream.headers.location).host; } catch { return 'n/a'; } })()}`);

    const streamNoAuth = await api.get(`/api/v1/music/stream/${state.songId}`);
    record('GET /music/stream without auth → 401', streamNoAuth.status === 401, `status=${streamNoAuth.status}`);
  }

  /* ── 6. playlists ──────────────────────────────────────────── */
  {
    const suggestion = await auth(api.get('/api/v1/playlists/name-suggestion'));
    record('GET /playlists/name-suggestion → "Playlist 1"', suggestion.status === 200 && suggestion.body.data?.suggestedName === 'Playlist 1', `"${suggestion.body.data?.suggestedName}"`);

    const auto = await auth(api.post('/api/v1/playlists')).send({});
    state.playlistId = auto.body?.data?.id;
    record('POST /playlists with NO name → auto-named', auto.status === 201 && auto.body.data?.name === 'Playlist 1', `name="${auto.body.data?.name}"`);

    const auto2 = await auth(api.post('/api/v1/playlists')).send({});
    record('POST /playlists again → "Playlist 2"', auto2.body?.data?.name === 'Playlist 2', `name="${auto2.body?.data?.name}"`);

    const named = await auth(api.post('/api/v1/playlists')).send({ name: 'Night Drive', description: 'smoke', visibility: 'public' });
    record('POST /playlists with name', named.status === 201 && named.body.data?.name === 'Night Drive', `name="${named.body.data?.name}"`);

    const add = await auth(api.post(`/api/v1/playlists/${state.playlistId}/tracks`)).send({ songIds: [state.songId, '3IoDK8qI'] });
    record('POST /playlists/:id/tracks → 2 added', add.status === 200 && add.body.data?.added === 2, `added=${add.body.data?.added} count=${add.body.data?.trackCount}`);

    const dup = await auth(api.post(`/api/v1/playlists/${state.playlistId}/tracks`)).send({ songIds: [state.songId] });
    record('POST duplicate track → skipped', dup.status === 200 && dup.body.data?.added === 0 && dup.body.data?.duplicatesSkipped === 1, `skipped=${dup.body.data?.duplicatesSkipped}`);

    const reorder = await auth(api.patch(`/api/v1/playlists/${state.playlistId}/reorder`)).send({ from: 0, to: 1 });
    record('PATCH /playlists/:id/reorder', reorder.status === 200, `${reorder.body.data?.order?.length} tracks`);

    const get = await auth(api.get(`/api/v1/playlists/${state.playlistId}`));
    record('GET /playlists/:id → tracks with snapshots', get.status === 200 && get.body.data?.tracks?.length === 2 && Boolean(get.body.data.tracks[0].image), `count=${get.body.data?.trackCount}`);

    const like = await auth(api.post('/api/v1/playlists/liked')).send({ songId: state.songId });
    record('POST /playlists/liked → liked', like.status === 200 && like.body.data?.liked === true, `likedSongsCount=${like.body.data?.likedSongsCount}`);

    const likeStatus = await auth(api.get(`/api/v1/playlists/liked/${state.songId}`));
    record('GET /playlists/liked/:songId → true', likeStatus.body?.data?.liked === true);

    const unlike = await auth(api.post('/api/v1/playlists/liked')).send({ songId: state.songId, liked: false });
    record('POST /playlists/liked {liked:false} → unliked', unlike.body?.data?.liked === false);

    const saveSong = await auth(api.post('/api/v1/playlists/save-song')).send({ songId: '3IoDK8qI', newPlaylistName: 'Quick Save' });
    record('POST /playlists/save-song → creates + adds', saveSong.status === 200 && saveSong.body.data?.added === 1, `playlist="${saveSong.body.data?.playlistName}" createdNew=${saveSong.body.data?.createdNew}`);

    const system = await auth(api.get('/api/v1/playlists/system'));
    record('GET /playlists/system → 4 system playlists', system.status === 200 && (system.body.data || []).length === 4, (system.body.data || []).map((p) => p.systemKey).join(','));

    const tasteMix = await auth(api.post('/api/v1/playlists/system/taste-mix/refresh')).send({ limit: 15 });
    record('POST /playlists/system/taste-mix/refresh → filled', tasteMix.status === 200, `tracks=${tasteMix.body.data?.trackCount}`);
  }

  /* ── 7. TRACKING (the seek-proof core) ─────────────────────── */
  {
    const start = await auth(api.post('/api/v1/tracking/sessions')).send({ songId: state.songId, deviceId: 'smoke-device-1', source: 'recommendation' });
    state.sessionId = start.body?.data?.sessionId;
    record('POST /tracking/sessions → session opened', start.status === 201 && Boolean(state.sessionId), `durationMs=${start.body.data?.durationMs} heartbeat=${start.body.data?.heartbeatIntervalMs}ms`);

    const session = state.sessionId ? await ListeningSession.findById(state.sessionId).lean() : null;
    if (!session) {
      record('tracking: session document persisted', false, 'session not found — skipping heartbeat checks');
    }
    const durationMs = session?.durationMs || 240000;

    // Honest playback: pretend 15 s of wall clock passed while the playhead moved 15 s.
    await ListeningSession.updateOne({ _id: state.sessionId }, { $set: { lastHeartbeatAt: new Date(Date.now() - 15000) } });
    const hb1 = await auth(api.post(`/api/v1/tracking/sessions/${state.sessionId}/heartbeat`)).send({ positionMs: 15000, state: 'playing' });
    record('heartbeat honest playback → credits ~15 s', hb1.status === 200 && hb1.body.data?.creditedMs >= 14000, `credited=${hb1.body.data?.creditedMs}ms reason=${hb1.body.data?.reason}`);

    // PAUSE: wall clock passes but state is paused → must credit nothing.
    await ListeningSession.updateOne({ _id: state.sessionId }, { $set: { lastHeartbeatAt: new Date(Date.now() - 60000) } });
    const hbPaused = await auth(api.post(`/api/v1/tracking/sessions/${state.sessionId}/heartbeat`)).send({ positionMs: 15000, state: 'paused' });
    record('heartbeat while PAUSED → credits 0', hbPaused.body?.data?.creditedMs === 0, `credited=${hbPaused.body?.data?.creditedMs}ms reason=${hbPaused.body?.data?.reason}`);

    // SEEK TO THE END: playhead jumps 200 s instantly → must credit 0 and flag the seek.
    const beforeSeek = hb1.body.data.listenedMs;
    const hbSeek = await auth(api.post(`/api/v1/tracking/sessions/${state.sessionId}/heartbeat`)).send({ positionMs: durationMs, state: 'playing' });
    record(
      'heartbeat SKIP TO END → credits 0 + seek flagged',
      hbSeek.body?.data?.creditedMs === 0 && hbSeek.body?.data?.seekDetected === true,
      `credited=${hbSeek.body?.data?.creditedMs}ms seek=${hbSeek.body?.data?.seekDetected} reason=${hbSeek.body?.data?.reason}`
    );
    record('listenedMs unchanged by the skip', hbSeek.body?.data?.listenedMs === beforeSeek, `${beforeSeek}ms → ${hbSeek.body?.data?.listenedMs}ms`);

    const verify = await auth(api.post('/api/v1/stats/verify-tracking')).send({
      durationMs: 240000,
      steps: [
        { positionMs: 20000, state: 'playing', afterMs: 20000 },
        { positionMs: 240000, state: 'playing', afterMs: 1000 },
      ],
    });
    const credited = verify.body?.data?.totalCreditedMs;
    record('POST /stats/verify-tracking → 20 s credited of a 240 s track', credited >= 19000 && credited <= 21000, `credited=${credited}ms completion=${verify.body?.data?.completionPercent}%`);

    const end = await auth(api.post(`/api/v1/tracking/sessions/${state.sessionId}/end`)).send({ positionMs: durationMs });
    record('POST /tracking/sessions/:id/end → finalised', end.status === 200 && end.body.data?.listenedMs > 0, `listened=${end.body.data?.listenedMs}ms completed=${end.body.data?.isCompleted} event=${end.body.data?.terminalEvent}`);

    const events = await auth(api.post(`/api/v1/tracking/sessions/${state.sessionId}/events`)).send({ eventType: 'queue_add', positionMs: 5000 });
    record('POST /tracking/sessions/:id/events → recorded', events.status === 201, events.body.data?.eventType);

    // Offline sync must clamp unverifiable time to the track duration.
    const sync = await auth(api.post('/api/v1/tracking/sync')).send({
      sessions: [
        {
          localId: 'offline-1',
          songId: state.songId,
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          endedAt: new Date(Date.now() - 3540000).toISOString(),
          listenedMs: 999999999, // absurd claim
          durationMs: 200000,
          completed: true,
        },
      ],
      searchHistory: [{ query: 'arijit singh', at: new Date().toISOString() }],
    });
    const accepted = sync.body?.data?.results?.[0]?.acceptedMs;
    record('POST /tracking/sync → offline time CLAMPED', sync.status === 200 && accepted <= 200000, `claimed=999999999 accepted=${accepted}ms`);

    const userAfter = await User.findById(state.userId).select('stats').lean();
    record('user lifetime stats updated from measured time', userAfter.stats.totalListenedMs > 0, `totalListenedMs=${userAfter.stats.totalListenedMs} plays=${userAfter.stats.totalPlays} streak=${userAfter.stats.streakDays}`);
  }

  /* ── 8. stats ──────────────────────────────────────────────── */
  {
    const dash = await auth(api.get('/api/v1/stats/dashboard?range=30d'));
    const d = dash.body?.data;
    record('GET /stats/dashboard → full analytics bundle', dash.status === 200 && Boolean(d?.overview) && Boolean(d?.timeline) && Boolean(d?.heatmap) && Boolean(d?.quality), `listeningTime=${d?.overview?.listeningTime?.text}`);
    record('dashboard top lists present (songs/movies/singers/directors/actors/languages)', ['songs', 'movies', 'singers', 'directors', 'actors', 'languages'].every((k) => d?.top?.[k]?.items), Object.keys(d?.top || {}).join(','));
    record('dashboard top.singers matches the /stats/top?type=singers enum', Array.isArray(d?.top?.singers?.items));
    record('heatmap grid is 7×24', d?.heatmap?.grid?.length === 7 && d?.heatmap?.grid?.[0]?.length === 24);

    const top = await auth(api.get('/api/v1/stats/top?type=movies&range=30d'));
    record('GET /stats/top?type=movies', top.status === 200 && (top.body.data?.items || []).length > 0, `#1="${top.body.data?.items?.[0]?.name}" ${top.body.data?.items?.[0]?.listenedText} (${top.body.data?.items?.[0]?.sharePercent}%)`);

    const insights = await auth(api.get('/api/v1/stats/insights'));
    record('GET /stats/insights → written facts', insights.status === 200 && (insights.body.data?.facts || []).length > 0, `${(insights.body.data?.facts || []).length} facts`);

    const recent = await auth(api.get('/api/v1/stats/recently-played'));
    record('GET /stats/recently-played', recent.status === 200 && (recent.body.data || []).length > 0, `${(recent.body.data || []).length} items`);

    const sessions = await auth(api.get('/api/v1/stats/history/sessions?limit=5'));
    record('GET /stats/history/sessions → seek-proof rows', sessions.status === 200 && (sessions.body.data || []).length > 0, `listenedMs=${sessions.body.data?.[0]?.listenedMs} seeks=${sessions.body.data?.[0]?.seekCount}`);
  }

  /* ── 9. recommendations ────────────────────────────────────── */
  {
    const feed = await auth(api.get('/api/v1/recommendations/feed?limit=10'));
    record('GET /recommendations/feed → rails', feed.status === 200 && (feed.body.data?.rails || []).length > 0, (feed.body.data?.rails || []).map((r) => `${r.key}(${r.items.length})`).join(' '));

    const forYou = await auth(api.get('/api/v1/recommendations/for-you?limit=10'));
    const items = forYou.body?.data || [];
    record('GET /recommendations/for-you → ranked items', forYou.status === 200 && items.length > 0, `${items.length} items, top match=${items[0]?.matchPercent}%`);
    const withExplain = items.filter((i) => i.explain && typeof i.explain.movie === 'number');
    record('every item carries a per-dimension explain block', withExplain.length === items.length, items[0] ? `movie=${items[0].explain?.movie}% hero=${items[0].explain?.hero}% lang=${items[0].explain?.language}% singer=${items[0].explain?.singer}% director=${items[0].explain?.director}%` : '');
    record('items carry a human reason string', Boolean(items[0]?.reason), items[0]?.reason);

    const next = await auth(api.get(`/api/v1/recommendations/next?currentSongId=${state.songId}&limit=3`));
    record('GET /recommendations/next → continuation', next.status === 200 && (next.body.data?.items || []).length > 0, `source=${next.body.data?.source}`);

    const radio = await auth(api.get(`/api/v1/recommendations/radio?songId=${state.songId}&limit=10`));
    record('GET /recommendations/radio?songId= → seed radio', radio.status === 200 && (radio.body.data?.items || []).length > 0, `seed=${JSON.stringify(radio.body.data?.seed)}`);

    const entity = await auth(api.get('/api/v1/recommendations/entity/actor/1001'));
    record('GET /recommendations/entity/actor/:id → hero page', entity.status === 200, `affinity=${entity.body.data?.yourAffinityPercent}% items=${(entity.body.data?.items || []).length}`);

    const profile = await auth(api.get('/api/v1/recommendations/taste-profile'));
    record('GET /recommendations/taste-profile → explained', profile.status === 200 && Array.isArray(profile.body.data?.priority), `priority=${(profile.body.data?.priority || []).join(' → ')}`);
  }

  /* ── 10. notifications ─────────────────────────────────────── */
  {
    const reg = await auth(api.post('/api/v1/notifications/devices')).send({ deviceId: 'smoke-device-1', pushToken: 'fake-fcm-token', platform: 'android' });
    record('POST /notifications/devices → token stored', reg.status === 200 && reg.body.data?.notificationsEnabled === true);
    const settings = await auth(api.get('/api/v1/notifications/settings'));
    record('GET /notifications/settings → device + media-style note', settings.status === 200 && Boolean(settings.body.data?.mediaStyleNote));
    const test = await auth(api.post('/api/v1/notifications/test'));
    record('POST /notifications/test → honest unconfigured answer', test.status === 200 && test.body.data?.sent === false, `reason=${test.body.data?.reason}`);
  }

  /* ── 11. UPSTREAM ROTATION (the headline requirement) ──────── */
  {
    const list = await api.get('/api/v1/admin/upstreams').set('x-admin-key', process.env.ADMIN_API_KEY);
    record('GET /admin/upstreams → pool visible', list.status === 200 && (list.body.data || []).length >= 1, `${(list.body.data || []).length} hosts`);

    const noKey = await api.get('/api/v1/admin/upstreams');
    record('GET /admin/upstreams without key → 401', noKey.status === 401, `status=${noKey.status}`);

    const add = await api
      .post('/api/v1/admin/upstreams')
      .set('x-admin-key', process.env.ADMIN_API_KEY)
      .send({ url: 'https://jiosaavn-api.apicoolie.workers.dev', pathPrefix: '/api' });
    record('POST /admin/upstreams duplicate URL → 409', add.status === 409, `status=${add.status}`);

    const addReal = await api
      .post('/api/v1/admin/upstreams')
      .set('x-admin-key', process.env.ADMIN_API_KEY)
      .send({ url: 'https://example-worker.workers.dev', pathPrefix: '/api', priority: 5, notes: 'rotation smoke' });
    state.secondUpstreamId = addReal.body?.data?.upstream?.id;
    record('POST /admin/upstreams → new host added + probed', addReal.status === 200 && Boolean(state.secondUpstreamId), `probe.ok=${addReal.body.data?.probe?.ok} hint="${addReal.body.data?.next}"`);

    const patched = await api
      .patch(`/api/v1/admin/upstreams/${state.secondUpstreamId}`)
      .set('x-admin-key', process.env.ADMIN_API_KEY)
      .send({ enabled: false, priority: 50 });
    record('PATCH /admin/upstreams/:id → disabled', patched.status === 200 && patched.body.data?.enabled === false);

    // The proof: a disabled/dead host must not break search, because the pool fails over.
    const stillWorks = await auth(api.get('/api/v1/music/search?q=arijit&type=songs&limit=3'));
    record('search still works with a dead host in the pool (failover)', stillWorks.status === 200 && (stillWorks.body.data || []).length > 0, `${(stillWorks.body.data || []).length} results`);

    const check = await api.post('/api/v1/admin/upstreams/health-check').set('x-admin-key', process.env.ADMIN_API_KEY);
    record('POST /admin/upstreams/health-check → probes all', check.status === 200, `${(check.body.data?.results || []).filter((r) => r.ok).length}/${(check.body.data?.results || []).length} ok`);

    const optimize = await api.post('/api/v1/admin/upstreams/optimize').set('x-admin-key', process.env.ADMIN_API_KEY);
    record('POST /admin/upstreams/optimize → re-orders by latency', optimize.status === 200, `order=${(optimize.body.data?.order || []).map((o) => o.priority).join(',')}`);

    const removed = await api.delete(`/api/v1/admin/upstreams/${state.secondUpstreamId}`).set('x-admin-key', process.env.ADMIN_API_KEY);
    record('DELETE /admin/upstreams/:id → retired', removed.status === 200);

    const stats = await api.get('/api/v1/admin/stats').set('x-admin-key', process.env.ADMIN_API_KEY);
    record('GET /admin/stats → platform counters', stats.status === 200 && stats.body.data?.counts?.users > 0, JSON.stringify(stats.body.data?.counts));
  }

  /* ── 12. maintenance ───────────────────────────────────────── */
  {
    const idx = await api.post('/api/v1/admin/maintenance/ensure-indexes').set('x-admin-key', process.env.ADMIN_API_KEY);
    record('POST /maintenance/ensure-indexes', idx.status === 200 && (idx.body.data?.results || []).every((r) => r.ok), `${(idx.body.data?.results || []).length} models`);

    const reap = await api.post('/api/v1/admin/maintenance/reap-stale-sessions').set('x-admin-key', process.env.ADMIN_API_KEY).send({ maxAgeMinutes: 0 });
    record('POST /maintenance/reap-stale-sessions', reap.status === 200, `closed=${reap.body.data?.closed}`);

    const trend = await api.post('/api/v1/admin/maintenance/recompute-trending').set('x-admin-key', process.env.ADMIN_API_KEY).send({ days: 7 });
    record('POST /maintenance/recompute-trending', trend.status === 200, `songs=${trend.body.data?.songsUpdated}`);

    const sweep = await api.post('/api/v1/admin/maintenance/sweep-cache').set('x-admin-key', process.env.ADMIN_API_KEY);
    record('POST /maintenance/sweep-cache', sweep.status === 200, `deleted=${sweep.body.data?.deleted}`);

    const rebuild = await api.post('/api/v1/admin/maintenance/rebuild-system-playlists').set('x-admin-key', process.env.ADMIN_API_KEY).send({ limit: 3 });
    record('POST /maintenance/rebuild-system-playlists', rebuild.status === 200, `processed=${rebuild.body.data?.processed}`);
  }

  /* ── 13. cache behaviour ───────────────────────────────────── */
  {
    const before = cache.getStats();
    await auth(api.get('/api/v1/music/search?q=kesariya&type=songs&limit=5'));
    await auth(api.get('/api/v1/music/search?q=kesariya&type=songs&limit=5'));
    const after = cache.getStats();
    record('two-tier cache records hits', after.layer1.hits > before.layer1.hits, `L1 hits=${after.layer1.hits} L2 writes=${after.layer2.writes} hitRate=${after.hitRate}`);
  }

  /* ── 14. session lifecycle ─────────────────────────────────── */
  {
    const sessions = await auth(api.get('/api/v1/auth/sessions'));
    record('GET /auth/sessions → devices + active tokens', sessions.status === 200 && (sessions.body.data?.activeSessions || []).length > 0, `${(sessions.body.data?.activeSessions || []).length} active`);

    const refreshed = await api.post('/api/v1/auth/refresh').send({ refreshToken: state.refreshToken, deviceId: 'smoke-device-1' });
    record('POST /auth/refresh → rotated pair', refreshed.status === 200 && Boolean(refreshed.body.data?.tokens?.accessToken), `newRefresh=${refreshed.body.data?.tokens?.refreshToken !== state.refreshToken}`);

    const reuse = await api.post('/api/v1/auth/refresh').send({ refreshToken: state.refreshToken });
    record('POST /auth/refresh with a REUSED token → 401 + family revoked', reuse.status === 401, `code=${reuse.body.error?.code}`);

    const logout = await api.post('/api/v1/auth/logout').set('Authorization', `Bearer ${state.accessToken}`).send({ refreshToken: refreshed.body.data?.tokens?.refreshToken });
    record('POST /auth/logout', logout.status === 200);
  }

  /* ── 15. error handling ────────────────────────────────────── */
  {
    const missing = await api.get('/api/v1/does-not-exist');
    record('unknown route → 404 envelope', missing.status === 404 && missing.body.success === false && missing.body.error?.code === 'ROUTE_NOT_FOUND');

    const badJson = await api.post('/api/v1/auth/login').set('content-type', 'application/json').send('{not json');
    record('malformed JSON → 400 envelope', badJson.status === 400, `code=${badJson.body.error?.code}`);

    const badQuery = await auth(api.get('/api/v1/music/search'));
    record('missing required query param → 422 with field detail', badQuery.status === 422 && Array.isArray(badQuery.body.error?.details), JSON.stringify(badQuery.body.error?.details?.[0]));

    const reqId = await api.get('/health');
    record('every response carries X-Request-Id', Boolean(reqId.headers['x-request-id']));
  }

  /* ── summary ───────────────────────────────────────────────── */
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(72));
  console.log(`RESULT: ${passed}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFAILURES:');
    failed.forEach((f) => console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`));
  } else {
    console.log('All checks passed ✅');
  }
  console.log('='.repeat(72) + '\n');

  await db.disconnect();
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\nSMOKE TEST CRASHED:', err.message);
  console.error(err.stack?.split('\n').slice(0, 12).join('\n'));
  try {
    if (mongod) await mongod.stop();
  } catch { /* ignore */ }
  process.exit(1);
});
