// Auth store with persistent token storage — no refresh tokens, unlimited session
import { create } from 'zustand';
import { VinaraaPlayer } from '@/native/player';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  login: (user: any, tokens: { accessToken: string }) => Promise<void>;
  logout: (options?: { reason?: string }) => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: any) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,

  login: async (user, tokens) => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: tokens.accessToken });
    } catch (_e) {
      console.warn('VinaraaPlayer native plugin not available, storing in localStorage');
      localStorage.setItem('mockAccessToken', tokens.accessToken);
    }
    // Always store user so checkAuth can restore it
    localStorage.setItem('vinaraaUser', JSON.stringify(user));
    set({ isAuthenticated: true, user });
  },

  logout: async (options) => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: '' });
    } catch (_e) {
      localStorage.removeItem('mockAccessToken');
    }
    localStorage.removeItem('vinaraaUser');
    set({ isAuthenticated: false, user: null });
    
    if (options?.reason && typeof window !== 'undefined') {
      alert(options.reason); // For now alert, can be changed to toast later
    }
  },

  checkAuth: async () => {
    try {
      let token: string | null = null;
      try {
        const result = await VinaraaPlayer.getAccessToken();
        token = result?.token ?? null;
      } catch (_e) {
        token = localStorage.getItem('mockAccessToken');
      }

      if (token && token.length > 0) {
        const storedUser = localStorage.getItem('vinaraaUser');
        const user = storedUser ? JSON.parse(storedUser) : { name: 'User' };
        set({ isAuthenticated: true, user });

        if (navigator.onLine) {
          try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://vinaraa.onrender.com/api/v1';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${API_BASE}/users/me`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                localStorage.setItem('vinaraaUser', JSON.stringify(json.data));
                set({ user: json.data });
              }
            } else {
              const json = await res.json();
              const errCode = json.error?.code;
              if (res.status === 401 && ['TOKEN_INVALID', 'SESSION_REVOKED', 'USER_NOT_FOUND'].includes(errCode)) {
                useAuthStore.getState().logout({ reason: 'Your session ended. Please sign in again.' });
              }
            }
          } catch (e: any) {
            // Network failure or timeout -> stay logged in (offline mode)
          }
        }
      } else {
        set((state) => {
          if (!state.isAuthenticated) {
            return { isAuthenticated: false, user: null };
          }
          return state;
        });
      }
    } catch (_e) {
      console.warn('[Auth] checkAuth encountered an error, keeping current state:', _e);
    }
  },

  updateUser: (user) => {
    localStorage.setItem('vinaraaUser', JSON.stringify(user));
    set({ user });
  },
}));
