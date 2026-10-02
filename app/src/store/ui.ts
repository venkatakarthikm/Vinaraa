import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

interface UIState {
  toasts: ToastItem[];
  sheets: string[];
  playerLyricsOpen: boolean;
  playerInfoOpen: boolean;
  addToast: (message: string, type?: 'info' | 'success' | 'error', action?: { label: string; onClick: () => void }) => void;
  removeToast: (id: string) => void;
  pushSheet: (id: string) => void;
  popSheet: (id?: string) => void;
  setPlayerLyricsOpen: (open: boolean) => void;
  setPlayerInfoOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  sheets: [],
  playerLyricsOpen: false,
  playerInfoOpen: false,

  addToast: (message, type = 'info', action) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [{ id, message, type, action }, ...s.toasts].slice(0, 2) }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  pushSheet: (id) => set((s) => ({ sheets: [...s.sheets, id] })),
  popSheet: (id) => set((s) => ({ sheets: id ? s.sheets.filter(sId => sId !== id) : s.sheets.slice(0, -1) })),

  setPlayerLyricsOpen: (open) => set({ playerLyricsOpen: open }),
  setPlayerInfoOpen: (open) => set({ playerInfoOpen: open }),
}));
