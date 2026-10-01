import { create } from 'zustand';

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
  formats?: any[];
  downloadUrls?: { quality: string; url: string }[];
  singers?: { id: string; name: string }[];
  musicDirectors?: { id: string; name: string }[];
  actors?: { id: string; name: string }[];
  lyricists?: { id: string; name: string }[];
}

interface PlayerState {
  queue: Song[];
  history: Song[];
  currentIndex: number;
  isPlaying: boolean;
  desiredPlaying: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  shuffle: boolean;
  showPlayer: boolean;
  showQueue: boolean;
  sessionId: string | null;
  seekRequestMs: number | null;

  setQueue: (songs: Song[], startIndex?: number) => void;
  appendToQueue: (songs: Song[]) => void;
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
  setShowPlayer: (show: boolean) => void;
  setShowQueue: (show: boolean) => void;
  setSessionId: (id: string | null) => void;
  currentSong: () => Song | null;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  history: [],
  currentIndex: 0,
  isPlaying: false,
  desiredPlaying: false,
  positionMs: 0,
  durationMs: 0,
  repeat: 'all',
  shuffle: false,
  showPlayer: false,
  showQueue: false,
  sessionId: null,
  seekRequestMs: null,

  setQueue: (songs, startIndex = 0) => {
    const song = songs[startIndex];
    set({
      queue: songs,
      currentIndex: startIndex,
      positionMs: 0,
      durationMs: song?.durationMs || 0,
      history: [],
      isPlaying: true,
      desiredPlaying: true,
    });
  },
  appendToQueue: (songs) => set((state) => ({ queue: [...state.queue, ...songs] })),
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
  setShuffle: (shuffle) => set({ shuffle }),
  nextTrack: () => {
    const { queue, currentIndex, history, repeat, shuffle } = get();
    const currentSong = queue[currentIndex];
    if (currentSong) {
      set({ history: [...history, currentSong] });
    }
    if (shuffle && queue.length > 1) {
      let nextIndex = Math.floor(Math.random() * queue.length);
      while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * queue.length);
      set({ currentIndex: nextIndex, positionMs: 0, isPlaying: true, desiredPlaying: true });
      return;
    }
    if (currentIndex < queue.length - 1) {
      set({ currentIndex: currentIndex + 1, positionMs: 0, isPlaying: true, desiredPlaying: true });
    } else if (repeat === 'all') {
      set({ currentIndex: 0, positionMs: 0, isPlaying: true, desiredPlaying: true });
    } else {
      set({ isPlaying: false, desiredPlaying: false });
    }
  },
  previousTrack: () => {
    const { positionMs, currentIndex, history } = get();
    if (positionMs > 3000) {
      get().seekTo(0);
      return;
    }
    const newIndex = Math.max(0, currentIndex - 1);
    const newHistory = history.length > 0 ? history.slice(0, -1) : history;
    set({ history: newHistory, currentIndex: newIndex, positionMs: 0, isPlaying: true, desiredPlaying: true });
  },
  setShowPlayer: (show) => set({ showPlayer: show }),
  setShowQueue: (show) => set({ showQueue: show }),
  setSessionId: (id) => set({ sessionId: id }),
  currentSong: () => {
    const { queue, currentIndex } = get();
    return queue[currentIndex] ?? null;
  },
}));
