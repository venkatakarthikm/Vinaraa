import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProgressState {
  positionMs: number;
  durationMs: number;
  bufferedMs: number;
  epoch: number;

  setPosition: (positionMs: number) => void;
  setDuration: (durationMs: number) => void;
  setBuffered: (bufferedMs: number) => void;
  incrementEpoch: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      positionMs: 0,
      durationMs: 0,
      bufferedMs: 0,
      epoch: 0,

      setPosition: (positionMs) => set({ positionMs }),
      setDuration: (durationMs) => set({ durationMs }),
      setBuffered: (bufferedMs) => set({ bufferedMs }),
      incrementEpoch: () => set((state) => ({ epoch: state.epoch + 1 })),
    }),
    {
      name: 'vinaraa-progress-storage',
      partialize: (state) => ({
        positionMs: state.positionMs,
        durationMs: state.durationMs,
      }),
    }
  )
);
