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

export function markQueueMutation() {
  queueVersion++;
}

export function startPlayerEngine() {
  if (started) return;
  started = true;
  const st = usePlayerStore;

  const checkNotificationIntent = async () => {
    try {
      const res = await VinaraaPlayer.checkIntent();
      if (res.openPlayer) {
        window.dispatchEvent(new Event('openPlayerIntent'));
      }
    } catch (e) {}
  };
  checkNotificationIntent();
  
  // We don't push queue to native on startup. We wait for play toggle (nativeLoaded).
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
    if (song && (song.id !== loadedId || queueVersion !== lastQueueVersion)) {
      loadedId = song.id;
      lastQueueVersion = queueVersion;
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
          await VinaraaPlayer.resume();
        }
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
      }).catch(console.error).finally(() => { setTimeout(() => { fetchingMore = false; }, 2000); });
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
        st.setState({ currentIndex: e.index, isPlaying: e.isPlaying ?? true });
      }
      useProgressStore.setState({ positionMs: 0, durationMs: song?.durationMs ?? 0, epoch: p.epoch + 1 });
    }
  });

  VinaraaPlayer.addListener('progress', (e: any) => {
    consecutiveErrors = 0;
    if (!e.songId || e.songId !== loadedId) return; // Stale progress
    if (st.getState().seekRequestMs == null) {
      useProgressStore.setState({
        positionMs: e.positionMs,
        durationMs: e.durationMs > 0 ? e.durationMs : useProgressStore.getState().durationMs,
        bufferedMs: e.bufferedMs,
      });
    }
  });

  VinaraaPlayer.addListener('playbackStateChanged', async (e: any) => {
    if (e.type === 'ended') {
      onEnded();
      return;
    }
    if (e.type === 'seeked' && typeof e.positionMs === 'number') {
      useProgressStore.setState({ positionMs: e.positionMs });
      return;
    }
    if (typeof e.isPlaying === 'boolean') {
      st.setState({ isPlaying: e.isPlaying });
    }
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

  // Removed blind polling
}

function onEnded() {
  const s = usePlayerStore.getState();
  s.nextTrack();
}
