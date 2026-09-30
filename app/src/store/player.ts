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
}

interface PlayerState {
  queue: Song[];
  history: Song[];
  currentIndex: number;
  isPlaying: boolean;
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
  positionMs: 0,
  durationMs: 0,
  repeat: 'off',
  shuffle: false,
  showPlayer: false,
  showQueue: false,
  sessionId: null,
  seekRequestMs: null,

  setQueue: (songs, startIndex = 0) => {
    set({ queue: songs, currentIndex: startIndex, positionMs: 0, history: [] });
  },
  appendToQueue: (songs) => set((state) => ({ queue: [...state.queue, ...songs] })),
  setPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPosition: (positionMs) => set({ positionMs }),
  seekTo: (ms) => set({ seekRequestMs: ms, positionMs: ms }),
  clearSeek: () => set({ seekRequestMs: null }),
  setDuration: (durationMs) => set({ durationMs }),
  setRepeat: (mode) => set({ repeat: mode }),
  setShuffle: (shuffle) => set({ shuffle }),
  nextTrack: () => {
    const { queue, currentIndex, history, repeat } = get();
    const currentSong = queue[currentIndex];
    if (currentSong) {
      set({ history: [...history, currentSong] });
    }
    if (repeat === 'one') {
      set({ positionMs: 0 });
      return;
    }
    if (currentIndex < queue.length - 1) {
      set({ currentIndex: currentIndex + 1, positionMs: 0 });
    } else if (repeat === 'all') {
      set({ currentIndex: 0, positionMs: 0 });
    }
  },
  previousTrack: () => {
    const { positionMs, currentIndex, history } = get();
    if (positionMs > 3000) {
      set({ positionMs: 0 });
      return;
    }
    if (history.length > 0) {
      const newHistory = [...history];
      newHistory.pop();
      set({ history: newHistory, currentIndex: Math.max(0, currentIndex - 1), positionMs: 0 });
    } else {
      set({ currentIndex: Math.max(0, currentIndex - 1), positionMs: 0 });
    }
  },
  setShowPlayer: (show) => set({ showPlayer: show }),
  setShowQueue: (show) => set({ showQueue: show }),
  setSessionId: (id) => set({ sessionId: id }),
  currentSong: () => {
    const { queue, currentIndex } = get();
    return queue[currentIndex] ?? null;
  },
}));
