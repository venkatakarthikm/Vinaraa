import { usePlayerStore } from '@/store/player';

import { Capacitor } from '@capacitor/core';

export function updateMediaSession() {
  if (Capacitor.isNativePlatform()) return;
  if (!('mediaSession' in navigator)) return;
  const song = usePlayerStore.getState().currentSong();
  if (!song) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.name,
    artist: song.artist,
    album: song.album || '',
    artwork: song.image ? [{ src: song.image, sizes: '500x500', type: 'image/jpeg' }] : [],
  });

  navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().setPlaying(true));
  navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().setPlaying(false));
  navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().previousTrack());
  navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().nextTrack());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) {
      usePlayerStore.getState().seekTo(details.seekTime * 1000);
    }
  });
}
