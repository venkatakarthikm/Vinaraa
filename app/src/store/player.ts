import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ensurePlayable } from '@/player/resolve';
import { markQueueMutation } from '@/player/engine';

export type RepeatMode = 'off' | 'all' | 'one';

export interface Song {
  id: string;
  name: string;
  artist: string;
  album?: string;
  albumId?: string;
  image?: string;
  durationMs?: number;
  language?: string;
  streamUrl?: string;
  localPath?: string;
  formats?: any[];
  downloadUrls?: { quality: string; url: string }[];
  singers?: { id: string; name: string }[];
  musicDirectors?: { id: string; name: string }[];
  actors?: { id: string; name: string }[];
  lyricists?: { id: string; name: string }[];
}

interface PlayerState {
  queue: Song[];
  currentIndex: number;
  isPlaying: boolean;
  desiredPlaying: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  shuffle: boolean;
  showQueue: boolean;
  sessionId: string | null;
  seekRequestMs: number | null;

  setQueue: (songs: Song[], startIndex?: number, source?: string, contextId?: string) => Promise<void>;
  appendToQueue: (songs: Song[]) => void;
  playNext: (song: Song) => void;
  setPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setPosition: (positionMs: number) => void;
  seekTo: (ms: number) => void;
  clearSeek: () => void;
  setDuration: (durationMs: number) => void;
  setDurationFromSong: (ms: number) => void;
  setRepeat: (mode: RepeatMode) => void;
  setShuffle: (shuffle: boolean) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setShowQueue: (show: boolean) => void;
  setSessionId: (id: string | null) => void;
  currentSong: () => Song | null;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      desiredPlaying: false,
      positionMs: 0,
      durationMs: 0,
      repeat: 'all',
      shuffle: false,
      showQueue: false,
      sessionId: null,
      seekRequestMs: null,

      setQueue: async (songs, startIndex = 0, source, contextId) => {
        const song = songs[startIndex];
        if (!song) return;
        const playableSong = await ensurePlayable(song);
        const resolvedSongs = [...songs];
        resolvedSongs[startIndex] = playableSong;
        
        import('@/native/player').then(({ VinaraaPlayer }) => {
          VinaraaPlayer.setPlaybackContext({ source, contextId }).catch(() => {});
        });

        markQueueMutation();
        set({
          queue: resolvedSongs,
          currentIndex: startIndex,
          positionMs: 0,
          durationMs: playableSong?.durationMs || 0,
          isPlaying: true,
          desiredPlaying: true,
        });
      },
      appendToQueue: async (songs) => {
        const playableSongs = await Promise.all(songs.map(ensurePlayable));
        set((state) => ({ queue: [...state.queue, ...playableSongs] }));
        markQueueMutation();
        const items = playableSongs.map(s => ({
          songId: s.id, streamUrl: s.streamUrl!, title: s.name, artist: s.artist, artwork: s.image
        }));
        import('@/native/player').then(({ VinaraaPlayer }) => {
          VinaraaPlayer.appendItems({ items }).catch(console.error);
        });
      },
      playNext: async (song) => {
        const s = await ensurePlayable(song);
        const { queue, currentIndex } = get();
        if (!queue.length) {
          get().setQueue([s], 0);
          return;
        }
        
        const existingIdx = queue.findIndex((q, i) => i > currentIndex && q.id === s.id);
        const updated = [...queue];
        if (existingIdx !== -1) {
            updated.splice(existingIdx, 1);
        }
        updated.splice(currentIndex + 1, 0, s);
        set({ queue: updated });
        markQueueMutation();

        import('@/native/player').then(({ VinaraaPlayer }) => {
          if (existingIdx !== -1) {
            VinaraaPlayer.moveItem({ from: existingIdx, to: currentIndex + 1 }).catch(console.error);
          } else {
            VinaraaPlayer.insertNext({
              item: { songId: s.id, streamUrl: s.streamUrl!, title: s.name, artist: s.artist, artwork: s.image }
            }).catch(console.error);
          }
        });
      },
      setPlaying: (isPlaying) => set({ desiredPlaying: isPlaying, isPlaying }),
      togglePlay: () => set((state) => ({ desiredPlaying: !state.desiredPlaying })),
      setPosition: (positionMs) => set({ positionMs }),
      seekTo: (ms) => set({ seekRequestMs: ms }),
      clearSeek: () => set({ seekRequestMs: null }),
      setDuration: (durationMs) => set({ durationMs }),
      setDurationFromSong: (ms) => {
        if (ms > 0) set({ durationMs: ms });
      },
      setRepeat: (mode) => {
        set({ repeat: mode });
        import('@/native/player').then(({ VinaraaPlayer }) => {
          VinaraaPlayer.setRepeatMode({ mode }).catch(() => {});
        });
      },
      setShuffle: (shuffle) => {
        set({ shuffle });
        import('@/native/player').then(({ VinaraaPlayer }) => {
          VinaraaPlayer.setShuffle({ shuffle }).catch(() => {});
        });
      },
      nextTrack: () => {
        const { queue, currentIndex, repeat } = get();
        if (!queue.length) return;

        let nextIdx = currentIndex + 1;
        if (nextIdx >= queue.length) {
          if (repeat === 'all') {
            nextIdx = 0;
          } else {
            return;
          }
        }

        get().setQueue(queue, nextIdx);
        import('@/native/player').then(({ VinaraaPlayer }) => {
          VinaraaPlayer.next().catch(console.error);
        });
      },
      previousTrack: () => {
        const { queue, currentIndex } = get();
        if (!queue.length) return;

        let prevIdx = currentIndex - 1;
        if (prevIdx < 0) {
          prevIdx = queue.length - 1;
        }

        get().setQueue(queue, prevIdx);
        import('@/native/player').then(({ VinaraaPlayer }) => {
          VinaraaPlayer.previous().catch(console.error);
        });
      },
      setShowQueue: (show) => set({ showQueue: show }),
      setSessionId: (id) => set({ sessionId: id }),
      currentSong: () => {
        const { queue, currentIndex } = get();
        return queue[currentIndex] ?? null;
      },
    }),
    {
      name: 'vinaraa-player-storage',
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        repeat: state.repeat,
        shuffle: state.shuffle,
      }),
    }
  )
);
