import { VinaraaPlayer } from '@/native/player';
import { usePlayerStore } from '@/store/player';
import { recommendations, tracking } from '@/api/endpoints';
import { formatPlayerSong } from '@/utils/song';
import { updateMediaSession } from './MediaSessionService';

let started = false;
let loadedId: string | null = null;
let fetchingMore = false;
let currentSessionId: string | null = null;
let activeSongIdForTracking: string | null = null;
let lastHeartbeatMs = 0;

export function startPlayerEngine() {
  if (started) return;
  started = true;
  const st = usePlayerStore;

  // 1) JS store → native player
  st.subscribe(async (s, prev) => {
    const song = s.queue[s.currentIndex];

    // A) New song loaded — always call play() with new URL
    if (song && song.id !== loadedId) {
      const oldPosition = prev.positionMs || 0;
      const targetSongId = song.id;
      activeSongIdForTracking = targetSongId;

      // End previous session
      if (currentSessionId && oldPosition > 0) {
        const oldSession = currentSessionId;
        currentSessionId = null;
        tracking.endSession(oldSession, Math.round(oldPosition)).catch(() => {});
      }

      loadedId = song.id;
      lastHeartbeatMs = 0;
      console.log(`[Player Engine] Loading:`, song.name, song.streamUrl);

      // Start tracking
      tracking.startSession(targetSongId).then((res) => {
        if (res?.sessionId && activeSongIdForTracking === targetSongId) {
          currentSessionId = res.sessionId;
        }
      }).catch(() => {});

      // Always play the new song — this also handles auto-play after next/prev
      await VinaraaPlayer.play({
        songId: song.id,
        streamUrl: song.streamUrl!,
        title: song.name,
        artist: song.artist,
        artwork: song.image,
      });
      updateMediaSession();
      return;
    }

    // B) Same song, play state toggled
    if (song && s.isPlaying !== prev.isPlaying) {
      if (s.isPlaying) {
        await VinaraaPlayer.resume();
      } else {
        await VinaraaPlayer.pause();
      }
    }

    // C) Seek requested from JS (in-app progress bar drag)
    if (s.seekRequestMs != null && s.seekRequestMs !== prev.seekRequestMs) {
      await VinaraaPlayer.seekTo({ positionMs: s.seekRequestMs });
      s.clearSeek();
    }

    // D) Pre-fetch more tracks when queue is nearly empty
    if (s.queue.length - s.currentIndex <= 2 && !fetchingMore && s.queue.length > 0) {
      fetchingMore = true;
      const cur = s.queue[s.queue.length - 1];
      recommendations.next(cur.id).then(rec => {
        const items = (rec?.items || rec?.songs || []).map(formatPlayerSong);
        const newItems = items.filter((item: any) => !usePlayerStore.getState().queue.some(q => q.id === item.id));
        if (newItems.length) {
          usePlayerStore.getState().appendToQueue(newItems);
        }
      }).finally(() => { fetchingMore = false; });
    }
  });

  // 2) Native → JS store
  VinaraaPlayer.addListener('playbackStateChanged', async (e: any) => {
    if (e.type === 'ended') {
      onEnded();
      return;
    }
    // Handle seek from notification/lock screen controls
    if (e.type === 'seeked' && typeof e.positionMs === 'number') {
      // Update position without triggering another seek request
      st.setState({ positionMs: e.positionMs });
      return;
    }
    if (typeof e.isPlaying === 'boolean') {
      st.setState({ isPlaying: e.isPlaying });
    }
  });

  VinaraaPlayer.addListener('error', () => {
    st.setState({ isPlaying: false });
    // Try next track on playback error
    setTimeout(() => {
      const s = st.getState();
      if (!s.isPlaying && s.queue.length > s.currentIndex + 1) {
        s.nextTrack();
      }
    }, 1000);
  });

  // Notification next/prev buttons
  VinaraaPlayer.addListener('nextTrack', () => {
    st.getState().nextTrack();
  });
  VinaraaPlayer.addListener('previousTrack', () => {
    st.getState().previousTrack();
  });

  // 3) Position/duration polling
  setInterval(async () => {
    if (!st.getState().queue.length) return;
    const n = await VinaraaPlayer.getState().catch(() => null);
    if (n) {
      st.setState({
        positionMs: n.positionMs,
        durationMs: n.durationMs || st.getState().durationMs,
      });

      // Heartbeat every 10 seconds
      if (currentSessionId && n.positionMs - lastHeartbeatMs >= 10000) {
        lastHeartbeatMs = n.positionMs;
        tracking.heartbeat(currentSessionId, {
          positionMs: Math.round(n.positionMs),
          state: st.getState().isPlaying ? 'playing' : 'paused',
        }).catch(() => {});
      }
    }
  }, 500);
}

function onEnded() {
  const s = usePlayerStore.getState();
  const { repeat, queue } = s;

  if (repeat === 'one') {
    // For repeat-one: seek back to 0 and resume — do NOT call setQueue (it resets history)
    // Directly seek on native player and update store position
    VinaraaPlayer.seekTo({ positionMs: 0 })
      .then(() => VinaraaPlayer.resume())
      .catch(() => {});
    usePlayerStore.setState({ positionMs: 0, isPlaying: true });
    return;
  }

  // For normal next / repeat-all
  if (queue.length === 1) {
    // Edge case: only 1 song in queue — nextTrack() won't change the index or song ID,
    // so the engine subscriber won't detect a change. Force re-play by clearing loadedId.
    loadedId = null;
    usePlayerStore.setState({ positionMs: 0, isPlaying: true });
    // ↑ This triggers subscriber: song.id !== loadedId(null) → calls VinaraaPlayer.play()
    return;
  }

  // Normal multi-song case — nextTrack() changes the index, subscriber detects new song ID
  s.nextTrack();
}

