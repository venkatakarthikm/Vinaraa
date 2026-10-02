import { create } from 'zustand';
import { users } from '@/api/endpoints';

export type ThemeId = 'classic' | 'glass' | 'lagoon' | 'mint';
export type ThemeMode = 'system' | 'light' | 'dark';
export type PlayerStyle = 'cinematic' | 'glass' | 'vinyl' | 'classic' | 'lyrics';
export type AmbientLevel = 'off' | 'low' | 'normal';

export interface UserPrefs {
  theme: ThemeId;
  mode: ThemeMode;
  playerStyle: PlayerStyle;
  ambientGlow: AmbientLevel;
  reduceEffects: boolean;
  libraryView: 'list' | 'grid';
  sorts: Record<string, string>;
}

const DEFAULT_PREFS: UserPrefs = {
  theme: 'classic',
  mode: 'system',
  playerStyle: 'cinematic',
  ambientGlow: 'normal',
  reduceEffects: false,
  libraryView: 'list',
  sorts: {},
};

function loadPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem('vinaraa.prefs');
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to load prefs:', e);
  }
  return DEFAULT_PREFS;
}

function savePrefs(prefs: UserPrefs) {
  try {
    localStorage.setItem('vinaraa.prefs', JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save prefs:', e);
  }
}

export function applyThemeAndMode(theme: ThemeId, mode: ThemeMode) {
  let resolvedMode = mode;
  if (mode === 'system') {
    resolvedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-mode', resolvedMode);
}

interface PrefsState extends UserPrefs {
  setTheme: (theme: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  setPlayerStyle: (style: PlayerStyle) => void;
  setAmbientGlow: (level: AmbientLevel) => void;
  setReduceEffects: (reduce: boolean) => void;
  setLibraryView: (view: 'list' | 'grid') => void;
  setSort: (key: string, value: string) => void;
}

export const usePrefsStore = create<PrefsState>((set, get) => {
  const initial = loadPrefs();
  applyThemeAndMode(initial.theme, initial.mode);

  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const { theme, mode } = get();
      if (mode === 'system') {
        applyThemeAndMode(theme, mode);
      }
    });
  }

  return {
    ...initial,

    setTheme: (theme) => {
      const next = { ...get(), theme };
      savePrefs(next);
      applyThemeAndMode(theme, next.mode);
      set({ theme });
    },

    setMode: (mode) => {
      const next = { ...get(), mode };
      savePrefs(next);
      applyThemeAndMode(next.theme, mode);
      set({ mode });
      users.updatePreferences({ themeMode: mode }).catch(() => {});
    },

    setPlayerStyle: (playerStyle) => {
      const next = { ...get(), playerStyle };
      savePrefs(next);
      set({ playerStyle });
    },

    setAmbientGlow: (ambientGlow) => {
      const next = { ...get(), ambientGlow };
      savePrefs(next);
      set({ ambientGlow });
    },

    setReduceEffects: (reduceEffects) => {
      const next = { ...get(), reduceEffects };
      savePrefs(next);
      set({ reduceEffects });
    },

    setLibraryView: (libraryView) => {
      const next = { ...get(), libraryView };
      savePrefs(next);
      set({ libraryView });
    },

    setSort: (key, value) => {
      const sorts = { ...get().sorts, [key]: value };
      const next = { ...get(), sorts };
      savePrefs(next);
      set({ sorts });
    },
  };
});
