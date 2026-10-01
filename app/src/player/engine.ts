import { VinaraaPlayer } from '@/native/player';
import { usePlayerStore } from '@/store/player';
import { recommendations, tracking } from '@/api/endpoints';
import { formatPlayerSong } from '@/utils/song';
import { updateMediaSession } from './MediaSessionService';

let started = false;
let loadedId: string | null = null;
let fetchingMore = false;
let currentSessionId: string | null = null;
let lastHeartbeatMs = 0;

export function startPlayerEngine() {
  if (started) return;
  started = true;
  const st = usePlayerStore;

  // 1) intent -> native
  st.subscribe(async (s, prev) => {
    const song = s.queue[s.currentIndex];
    
    // Check if the song has changed
    if (song && (song.id !== loadedId || s.queue !== prev.queue && song.id !== loadedId)) {
      // End previous session if it exists
      if (currentSessionId && prev.positionMs > 0) {
        tracking.endSession(currentSessionId, prev.positionMs).catch(() => {});
        currentSessionId = null;
      }
      
      loadedId = song.id;
      lastHeartbeatMs = 0;
      console.log(`[Player Engine] Streaming directly from CDN:`, song.streamUrl);
      
      // Start new tracking session
      tracking.startSession(song.id || song.saavnId).then((res) => {
        if (res?.sessionId) currentSessionId = res.sessionId;
      }).catch(() => {});

      await VinaraaPlayer.play({
        songId: song.id, streamUrl: song.streamUrl!, title: song.name,
        artist: song.artist, artwork: song.image,
      });
      updateMediaSession();
    } else if (s.isPlaying !== prev.isPlaying && song) {
      s.isPlaying ? VinaraaPlayer.resume() : VinaraaPlayer.pause();
    }
    if (s.seekRequestMs != null) {
      await VinaraaPlayer.seekTo({ positionMs: s.seekRequestMs });
      s.clearSeek();
    }
    
    // continuous listening: pre-fetch when 2 tracks remain
    if (s.queue.length - s.currentIndex <= 2 && !fetchingMore && s.queue.length > 0) {
      fetchingMore = true;
      const cur = s.queue[s.queue.length - 1];
      recommendations.next(cur.id).then(rec => {
        const items = (rec?.items || rec?.songs || []).map(formatPlayerSong);
        // filter out songs already in the queue
        const newItems = items.filter((item: any) => !usePlayerStore.getState().queue.some(q => q.id === item.id));
        if (newItems.length) {
          usePlayerStore.getState().appendToQueue(newItems);
        }
      }).finally(() => { fetchingMore = false; });
    }
  });

  // 2) native -> store
  VinaraaPlayer.addListener('playbackStateChanged', async (e: any) => {
    if (e.type === 'ended') return onEnded();
    if (typeof e.isPlaying === 'boolean') st.setState({ isPlaying: e.isPlaying });
  });
  VinaraaPlayer.addListener('error', () => st.setState({ isPlaying: false }));

  // 3) real position/duration (replaces the fake timer)
  setInterval(async () => {
    if (!st.getState().queue.length) return;
    const n = await VinaraaPlayer.getState().catch(() => null);
    if (n) {
      st.setState({ positionMs: n.positionMs, durationMs: n.durationMs || st.getState().durationMs });
      
      // Send heartbeat every 10 seconds
      if (currentSessionId && n.positionMs - lastHeartbeatMs >= 10000) {
        lastHeartbeatMs = n.positionMs;
        tracking.heartbeat(currentSessionId, { 
          positionMs: n.positionMs, 
          state: st.getState().isPlaying ? 'playing' : 'paused' 
        }).catch(() => {});
      }
    }
  }, 500);
}

async function onEnded() {
  const s = usePlayerStore.getState();
  s.nextTrack();
}
