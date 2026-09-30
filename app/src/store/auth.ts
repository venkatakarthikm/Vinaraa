// Updated auth store with persistent token storage
import { create } from 'zustand';
import { VinaraaPlayer } from '@/native/player';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  login: (user: any, tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: any) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  login: async (user, tokens) => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (_e) {
      console.warn('VinaraaPlayer native plugin not available', _e);
      localStorage.setItem('mockAccessToken', tokens.accessToken);
      localStorage.setItem('mockRefreshToken', tokens.refreshToken);
    }
    set({ isAuthenticated: true, user });
  },
  logout: async () => {
    try {
      await VinaraaPlayer.setAuth({ accessToken: '', refreshToken: '' });
    } catch (_e) {
      localStorage.removeItem('mockAccessToken');
      localStorage.removeItem('mockRefreshToken');
    }
    set({ isAuthenticated: false, user: null });
  },
  checkAuth: async () => {
    try {
      const result = await VinaraaPlayer.getAccessToken().catch(() => ({ token: localStorage.getItem('mockAccessToken') }));
      const token = result?.token;
      if (token) {
        // Restore user from localStorage in web mode
        const storedUser = localStorage.getItem('vinaraaUser');
        set({ isAuthenticated: true, user: storedUser ? JSON.parse(storedUser) : { name: 'User' } });
      } else {
        set({ isAuthenticated: false, user: null });
      }
    } catch (_e) {
      set({ isAuthenticated: false, user: null });
    }
  },
  updateUser: (user) => {
    localStorage.setItem('vinaraaUser', JSON.stringify(user));
    set({ user });
  },
}));
