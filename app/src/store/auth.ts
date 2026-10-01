// Auth store with persistent token storage — no refresh tokens, unlimited session
import { create } from 'zustand';
import { VinaraaPlayer } from '@/native/player';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  login: (user: any, tokens: { accessToken: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: any) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,

  login: async (user, tokens) => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: tokens.accessToken, refreshToken: '' });
    } catch (_e) {
      console.warn('VinaraaPlayer native plugin not available, storing in localStorage');
      localStorage.setItem('mockAccessToken', tokens.accessToken);
    }
    // Always store user so checkAuth can restore it
    localStorage.setItem('vinaraaUser', JSON.stringify(user));
    set({ isAuthenticated: true, user });
  },

  logout: async () => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: '', refreshToken: '' });
    } catch (_e) {
      localStorage.removeItem('mockAccessToken');
    }
    localStorage.removeItem('vinaraaUser');
    set({ isAuthenticated: false, user: null });
  },

  checkAuth: async () => {
    try {
      // Try native storage first (Android)
      let token: string | null = null;
      try {
        const result = await VinaraaPlayer.getAccessToken();
        token = result?.token ?? null;
      } catch (_e) {
        // Native plugin not available — fall back to localStorage (web)
        token = localStorage.getItem('mockAccessToken');
      }

      if (token && token.length > 0) {
        // Restore stored user data
        const storedUser = localStorage.getItem('vinaraaUser');
        const user = storedUser ? JSON.parse(storedUser) : { name: 'User' };
        set({ isAuthenticated: true, user });
      } else {
        // No token found — not logged in (but don't log out if already authenticated)
        set((state) => {
          // Only clear auth if we were previously NOT authenticated
          // This prevents spurious logouts on plugin init race conditions
          if (!state.isAuthenticated) {
            return { isAuthenticated: false, user: null };
          }
          return state; // Keep current state if already authenticated
        });
      }
    } catch (_e) {
      // Unexpected error — do NOT log out, just keep current state
      console.warn('[Auth] checkAuth encountered an error, keeping current state:', _e);
    }
  },

  updateUser: (user) => {
    localStorage.setItem('vinaraaUser', JSON.stringify(user));
    set({ user });
  },
}));
