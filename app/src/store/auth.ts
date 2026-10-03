import { create } from 'zustand';
import { VinaraaPlayer } from '@/native/player';
import { useUIStore } from '@/store/ui';

export interface User {
  id: string;
  name: string;
  handle?: string;
  email: string;
  avatarUrl?: string;
  role?: 'user' | 'admin';
  preferences?: any;
  onboarding?: any;
}

export type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated';

interface AuthState {
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  user: User | null;
  login: (user: User, tokens: { accessToken: string }) => Promise<void>;
  logout: (options?: { reason?: string }) => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authStatus: 'idle',
  isAuthenticated: false,
  user: null,

  login: async (user, tokens) => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: tokens.accessToken });
    } catch (_e) {
      console.warn('VinaraaPlayer native plugin not available, storing in localStorage');
      localStorage.setItem('mockAccessToken', tokens.accessToken);
    }
    localStorage.setItem('vinaraaUser', JSON.stringify(user));
    set({ isAuthenticated: true, user, authStatus: 'authenticated' });
  },

  logout: async (options) => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: '' });
    } catch (_e) {
      localStorage.removeItem('mockAccessToken');
    }
    localStorage.removeItem('vinaraaUser');
    set({ isAuthenticated: false, user: null, authStatus: 'unauthenticated' });
    
    if (options?.reason) {
      useUIStore.getState().addToast(options.reason, 'info');
    }
  },

  checkAuth: async () => {
    set((s) => ({ authStatus: s.authStatus === 'idle' ? 'checking' : s.authStatus }));
    try {
      let token: string | null = null;
      try {
        const result = await VinaraaPlayer.getAccessToken();
        token = result?.token ?? null;
      } catch (_e) {
        token = localStorage.getItem('mockAccessToken');
      }

      const storedUser = localStorage.getItem('vinaraaUser');
      const cachedUser = storedUser ? JSON.parse(storedUser) : null;

      if (token && token.length > 0) {
        if (cachedUser) {
          set({ isAuthenticated: true, user: cachedUser, authStatus: 'authenticated' });
        }

        if (navigator.onLine) {
          try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://vinaraa.onrender.com/api/v1';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(`${API_BASE}/users/me`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
              const json = await res.json();
              const profile = json?.data?.user ?? json?.data;
              if (profile?.name) {
                localStorage.setItem('vinaraaUser', JSON.stringify(profile));
                set({ isAuthenticated: true, user: profile, authStatus: 'authenticated' });
              }
            } else if (res.status === 401) {
              await useAuthStore.getState().logout({ reason: 'Your session ended. Please sign in again.' });
            }
          } catch (_e) {
            if (cachedUser) {
              set({ isAuthenticated: true, user: cachedUser, authStatus: 'authenticated' });
            }
          }
        }
      } else {
        set({ isAuthenticated: false, user: null, authStatus: 'unauthenticated' });
      }
    } catch (_e) {
      console.warn('[Auth] checkAuth error:', _e);
      set((s) => ({ authStatus: s.user ? 'authenticated' : 'unauthenticated' }));
    }
  },

  updateUser: (user) => {
    localStorage.setItem('vinaraaUser', JSON.stringify(user));
    set({ user });
  },
}));
