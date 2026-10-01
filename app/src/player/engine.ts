import { VinaraaPlayer } from '@/native/player';
import { usePlayerStore } from '@/store/player';
import { recommendations, tracking } from '@/api/endpoints';
import { formatPlayerSong } from '@/utils/song';
import { updateMediaSession } from './MediaSessionService';
import { App } from '@capacitor/app';

let started = false;
let loadedId: string | null = null;
let fetchingMore = false;
let currentSessionId: string | null = null;
let activeSongIdForTracking: string | null = null;
let lastHeartbeatMs = 0;
let lastQueueLength = 0;

export function startPlayerEngine() {
  if (started) return;
  started = true;
  const st = usePlayerStore;

  const checkNotificationIntent = async () => {
    try {
      const res = await VinaraaPlayer.checkIntent();
      if (res.openPlayer) {
        st.getState().setShowPlayer(true);
      }
    } catch (e) {}
  };
  checkNotificationIntent();
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) checkNotificationIntent();
  });
  window.addEventListener('openPlayerIntent', () => {
    st.getState().setShowPlayer(true);
  });

  // 1) JS store → native player
  st.subscribe(async (s, prev) => {
    const song = s.queue[s.currentIndex];

    // A) Queue or current song changed
    if (song && (song.id !== loadedId || s.queue.length !== lastQueueLength)) {
      const oldPosition = prev.positionMs || 0;
      const targetSongId = song.id;
      activeSongIdForTracking = targetSongId;

      if (currentSessionId && oldPosition > 0) {
        const oldSession = currentSessionId;
        currentSessionId = null;
        tracking.endSession(oldSession, Math.round(oldPosition)).catch(() => {});
      }

      loadedId = song.id;
      lastQueueLength = s.queue.length;
      lastHeartbeatMs = 0;
      console.log(`[Player Engine] Syncing queue to native:`, song.name, song.streamUrl);

      tracking.startSession(targetSongId).then((res) => {
        if (res?.sessionId && activeSongIdForTracking === targetSongId) {
          currentSessionId = res.sessionId;
        }
      }).catch(() => {});

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
        // Fallback to single play if setQueue fails
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

    // B) Play state toggled
    if (song && s.desiredPlaying !== prev.desiredPlaying) {
      if (s.desiredPlaying) {
        await VinaraaPlayer.resume();
      } else {
        await VinaraaPlayer.pause();
      }
    }

    // C) Seek requested
    if (s.seekRequestMs != null && s.seekRequestMs !== prev.seekRequestMs) {
      await VinaraaPlayer.seekTo({ positionMs: s.seekRequestMs });
      s.clearSeek();
    }

    // D) Pre-fetch when near end of queue
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

  VinaraaPlayer.addListener('songChanged', (e: any) => {
    if (typeof e.index === 'number' && e.index >= 0) {
      const s = st.getState();
      if (s.currentIndex !== e.index) {
        const nextSong = s.queue[e.index];
        if (nextSong) {
          loadedId = nextSong.id;
          activeSongIdForTracking = nextSong.id;
          if (currentSessionId) {
             tracking.endSession(currentSessionId, Math.round(s.positionMs || 0)).catch(() => {});
             currentSessionId = null;
          }
          lastHeartbeatMs = 0;
          tracking.startSession(nextSong.id).then((res) => {
             if (res?.sessionId && activeSongIdForTracking === nextSong.id) {
               currentSessionId = res.sessionId;
             }
          }).catch(() => {});
        }
        st.setState({ currentIndex: e.index, isPlaying: e.isPlaying ?? true, positionMs: 0 });
      }
    }
  });

  VinaraaPlayer.addListener('playbackStateChanged', async (e: any) => {
    if (e.type === 'ended') {
      onEnded();
      return;
    }
    if (e.type === 'seeked' && typeof e.positionMs === 'number') {
      st.setState({ positionMs: e.positionMs });
      return;
    }
    if (typeof e.isPlaying === 'boolean') {
      st.setState({ isPlaying: e.isPlaying });
    }
  });

  VinaraaPlayer.addListener('error', () => {
    st.setState({ isPlaying: false, desiredPlaying: false });
    setTimeout(() => {
      const s = st.getState();
      if (!s.isPlaying && s.queue.length > s.currentIndex + 1) {
        s.nextTrack();
      }
    }, 1000);
  });

  VinaraaPlayer.addListener('nextTrack', () => {
    st.getState().nextTrack();
  });
  VinaraaPlayer.addListener('previousTrack', () => {
    st.getState().previousTrack();
  });

  // 3) Polling
  setInterval(async () => {
    if (!st.getState().queue.length) return;
    const n = await VinaraaPlayer.getState().catch(() => null);
    if (n) {
      const nativeDur = n.durationMs;
      if (st.getState().seekRequestMs == null) {
        st.setState({
          positionMs: n.positionMs,
          durationMs: nativeDur && nativeDur > 0 ? nativeDur : st.getState().durationMs,
        });
      }

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
  s.nextTrack();
}
