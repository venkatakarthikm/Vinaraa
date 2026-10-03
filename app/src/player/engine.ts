import { VinaraaPlayer } from '@/native/player';
import { usePlayerStore } from '@/store/player';
import { useProgressStore } from '@/store/progress';
import { recommendations } from '@/api/endpoints';
import { formatPlayerSong } from '@/utils/song';
import { updateMediaSession } from './MediaSessionService';
import { App } from '@capacitor/app';
import { useUIStore } from '@/store/ui';

let started = false;
let loadedId: string | null = null;
let fetchingMore = false;
let lastQueueVersion = 0;
let queueVersion = 0;
let nativeLoaded = false;
let consecutiveErrors = 0;

// Timing guards (see applyPlaying / applyProgress)
let lastUserToggleAt = 0;
let seekingUntil = 0;
let applyingFromNative = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let mismatchCount = 0;

export function markQueueMutation() {
  queueVersion++;
}

/** Called by the store when the user taps play/pause, so late native echoes of the OLD state are ignored. */
export function markUserToggle() {
  lastUserToggleAt = Date.now();
}

/** Writes position/duration/buffered into the progress store (the only thing the seek bar, timer and lyrics read). */
function applyProgress(e: { positionMs?: number; durationMs?: number; bufferedMs?: number }) {
  if (Date.now() < seekingUntil) return; // just seeked by the user: keep the optimistic position briefly
  if (typeof e.positionMs !== 'number' || !isFinite(e.positionMs) || e.positionMs < 0) return;
  const cur = useProgressStore.getState();
  const duration = typeof e.durationMs === 'number' && e.durationMs > 0 ? e.durationMs : cur.durationMs;
  const buffered = typeof e.bufferedMs === 'number' ? e.bufferedMs : cur.bufferedMs;
  if (e.positionMs === cur.positionMs && duration === cur.durationMs && buffered === cur.bufferedMs) return;
  useProgressStore.setState({ positionMs: e.positionMs, durationMs: duration, bufferedMs: buffered });
}

/**
 * Writes the real native play state into the player store.
 * - Ignored for 1.2 s after a user tap (native may still report the old state).
 * - Ignored while native is buffering (state 2) and the user wants playback: native says "not playing" during buffering.
 * - Never causes a pause()/resume() call back to native (applyingFromNative).
 */
function applyPlaying(isPlaying: boolean, nativeState?: number) {
  if (Date.now() - lastUserToggleAt < 1200) return;
  const s = usePlayerStore.getState();
  if (nativeState === 2 && s.desiredPlaying) return;
  if (s.isPlaying === isPlaying && s.desiredPlaying === isPlaying) return;
  applyingFromNative = true;
  try {
    usePlayerStore.setState({ isPlaying, desiredPlaying: isPlaying });
  } finally {
    applyingFromNative = false;
  }
}

/** Safety net: asks native for its state every 500 ms, so the timer works even if native->JS events are not delivered. */
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const s = usePlayerStore.getState();
    if (!s.queue.length) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const st: any = await VinaraaPlayer.getState();
      if (!st || !st.songId) return;
      applyProgress(st);
      if (typeof st.isPlaying === 'boolean') {
        const current = usePlayerStore.getState().isPlaying;
        if (st.isPlaying !== current) {
          mismatchCount++;
          if (mismatchCount >= 3) {
            mismatchCount = 0;
            applyPlaying(st.isPlaying);
          }
        } else {
          mismatchCount = 0;
        }
      }
    } catch {
      /* native not ready yet */
    }
  }, 500);
}

export function startPlayerEngine() {
  if (started) return;
  started = true;
  const st = usePlayerStore;

  // Push initial repeat mode to native player so UI and player agree
  VinaraaPlayer.setRepeatMode({ mode: st.getState().repeat }).catch(() => {});

  const checkNotificationIntent = async () => {
    try {
      const res = await VinaraaPlayer.checkIntent();
      if (res.openPlayer) {
        window.dispatchEvent(new Event('openPlayerIntent'));
      }
    } catch (e) {}
  };
  checkNotificationIntent();

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      checkNotificationIntent();
      VinaraaPlayer.getState()
        .then((s: any) => {
          if (s?.songId) {
            applyProgress(s);
            if (typeof s.isPlaying === 'boolean') applyPlaying(s.isPlaying);
          }
        })
        .catch(() => {});
    }
  });

  st.subscribe(async (s, prev) => {
    const song = s.queue[s.currentIndex];

    if (song && (song.id !== loadedId || queueVersion !== lastQueueVersion)) {
      loadedId = song.id;
      lastQueueVersion = queueVersion;
      nativeLoaded = true;
      console.log(`[Player Engine] Syncing queue to native:`, song.name, song.streamUrl);

      await VinaraaPlayer.setQueue({
        items: s.queue.map((q) => ({
          songId: q.id,
          streamUrl: q.streamUrl!,
          title: q.name,
          artist: q.artist,
          artwork: q.image,
        })),
        startIndex: s.currentIndex,
        repeatMode: s.repeat,
        positionMs: s.positionMs,
        play: s.isPlaying || s.desiredPlaying,
      }).catch(() => {
        VinaraaPlayer.play({
          songId: song.id,
          streamUrl: song.streamUrl!,
          title: song.name,
          artist: song.artist,
          artwork: song.image,
        });
      });
      updateMediaSession();
      return;
    }

    // Play / pause requested by the UI (not by native)
    if (song && !applyingFromNative && s.desiredPlaying !== prev.desiredPlaying) {
      if (s.desiredPlaying) {
        if (!nativeLoaded) {
          nativeLoaded = true;
          loadedId = song.id;
          lastQueueVersion = queueVersion;
          await VinaraaPlayer.setQueue({
            items: s.queue.map((q) => ({
              songId: q.id,
              streamUrl: q.streamUrl!,
              title: q.name,
              artist: q.artist,
              artwork: q.image,
            })),
            startIndex: s.currentIndex,
            repeatMode: s.repeat,
            positionMs: useProgressStore.getState().positionMs,
            play: true,
          }).catch(console.error);
        } else {
          await VinaraaPlayer.resume().catch(console.error);
        }
      } else {
        await VinaraaPlayer.pause().catch(console.error);
      }
    }

    // Seek requested by the UI
    if (s.seekRequestMs != null && s.seekRequestMs !== prev.seekRequestMs) {
      const target = s.seekRequestMs;
      seekingUntil = Date.now() + 700;
      useProgressStore.setState({ positionMs: target });
      try {
        await VinaraaPlayer.seekTo({ positionMs: target });
      } catch (err) {
        console.warn('[Player Engine] seekTo failed', err);
      } finally {
        s.clearSeek(); // always release the seek request, otherwise it could block updates
      }
    }

    if (s.queue.length - s.currentIndex <= 2 && !fetchingMore && s.queue.length > 0) {
      fetchingMore = true;
      const cur = s.queue[s.queue.length - 1];
      recommendations
        .next(cur.id)
        .then((rec) => {
          const items = (rec?.items || rec?.songs || []).map(formatPlayerSong);
          const newItems = items.filter((item: any) => !usePlayerStore.getState().queue.some((q) => q.id === item.id));
          if (newItems.length) {
            usePlayerStore.getState().appendToQueue(newItems);
          }
        })
        .catch(console.error)
        .finally(() => {
          setTimeout(() => {
            fetchingMore = false;
          }, 2000);
        });
    }
  });

  VinaraaPlayer.addListener('songChanged', (e: any) => {
    if (typeof e.index === 'number' && e.index >= 0) {
      const s = st.getState();
      const p = useProgressStore.getState();
      const song = s.queue[e.index];
      if (s.currentIndex !== e.index) {
        if (song) {
          loadedId = song.id;
        }
        applyingFromNative = true;
        try {
          st.setState({ currentIndex: e.index, isPlaying: e.isPlaying ?? true, desiredPlaying: e.isPlaying ?? true });
        } finally {
          applyingFromNative = false;
        }
      }
      seekingUntil = 0;
      useProgressStore.setState({ positionMs: 0, durationMs: song?.durationMs ?? 0, epoch: p.epoch + 1 });
    }
  });

  VinaraaPlayer.addListener('progress', (e: any) => {
    consecutiveErrors = 0;
    applyProgress(e);
    if (typeof e.isPlaying === 'boolean') applyPlaying(e.isPlaying, e.state);
  });

  VinaraaPlayer.addListener('playbackStateChanged', async (e: any) => {
    if (e.type === 'ended') {
      onEnded();
      return;
    }
    if (e.type === 'seeked' && typeof e.positionMs === 'number') {
      applyProgress({ positionMs: e.positionMs });
      return;
    }
    if (typeof e.isPlaying === 'boolean') applyPlaying(e.isPlaying);
    if (typeof e.positionMs === 'number') applyProgress({ positionMs: e.positionMs });
  });

  VinaraaPlayer.addListener('error', (e: any) => {
    console.error('Player error:', e);
    consecutiveErrors++;
    if (consecutiveErrors >= 3) {
      VinaraaPlayer.stop().catch(() => {});
      st.setState({ isPlaying: false, desiredPlaying: false });
      useUIStore.getState().addToast('Playback failed consecutively. Please try again later.', 'error');
      consecutiveErrors = 0;
    } else {
      st.setState({ isPlaying: false, desiredPlaying: false });
      setTimeout(() => {
        const s = st.getState();
        if (!s.isPlaying && s.queue.length > s.currentIndex + 1) {
          s.nextTrack();
        }
      }, 1000);
    }
  });

  VinaraaPlayer.addListener('nextTrack', () => {
    st.getState().nextTrack();
  });
  VinaraaPlayer.addListener('previousTrack', () => {
    st.getState().previousTrack();
  });

  startPolling();
}

function onEnded() {
  const s = usePlayerStore.getState();
  s.nextTrack();
}