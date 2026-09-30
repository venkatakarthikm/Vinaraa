import { VinaraaPlayer } from '@/native/player';
import { usePlayerStore } from '@/store/player';
import { recommendations } from '@/api/endpoints';
import { formatPlayerSong } from '@/utils/song';

let started = false;
let loadedId: string | null = null;

export function startPlayerEngine() {
  if (started) return;
  started = true;
  const st = usePlayerStore;

  // 1) intent -> native
  st.subscribe(async (s, prev) => {
    const song = s.queue[s.currentIndex];
    if (song && (song.id !== loadedId || s.queue !== prev.queue && song.id !== loadedId)) {
      loadedId = song.id;
      await VinaraaPlayer.play({
        songId: song.id, streamUrl: song.streamUrl!, title: song.name,
        artist: song.artist, artwork: song.image,
      });
    } else if (s.isPlaying !== prev.isPlaying && song) {
      s.isPlaying ? VinaraaPlayer.resume() : VinaraaPlayer.pause();
    }
    if (s.seekRequestMs != null) {
      await VinaraaPlayer.seekTo({ positionMs: s.seekRequestMs });
      s.clearSeek();
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
    if (n) st.setState({ positionMs: n.positionMs, durationMs: n.durationMs || st.getState().durationMs });
  }, 500);
}

async function onEnded() {
  const s = usePlayerStore.getState();
  const last = s.currentIndex >= s.queue.length - 1;
  if (s.repeat === 'one') { loadedId = null; s.nextTrack(); return; }
  if (!last || s.repeat === 'all') { s.nextTrack(); return; }
  // continuous listening: queue finished -> ask backend for what plays next
  const cur = s.queue[s.currentIndex];
  const rec = await recommendations.next(cur.id).catch(() => null);
  const items = (rec?.items || rec?.songs || []).map(formatPlayerSong);
  if (items.length) { s.appendToQueue(items); s.nextTrack(); }
}
