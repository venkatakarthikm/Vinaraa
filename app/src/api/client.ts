import { z } from 'zod';
import { VinaraaPlayer } from '@/native/player';
import { getDeviceInfo } from '@/utils/device';
import { useAuthStore } from '@/store/auth';
import { Preferences } from '@capacitor/preferences';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export class ApiError extends Error {
  code: string;
  details?: any;
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

async function getToken(): Promise<string | null> {
  try {
    const { token } = await VinaraaPlayer.getAccessToken();
    return token;
  } catch (e) {
    return localStorage.getItem('mockAccessToken');
  }
}

async function getRefreshToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: 'vinaraa_refresh_token' });
  if (value) return value;
  return localStorage.getItem('mockRefreshToken') || localStorage.getItem('vinaraa_refresh_token');
}

let refreshing: Promise<boolean> | null = null;
async function refreshTokens(): Promise<boolean> {
  const rt = await getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt, deviceId: (await getDeviceInfo()).deviceId }),
    });
    if (!res.ok) return false;
    const { data } = await res.json();
    
    // We cannot use useAuthStore.getState().login because it also updates user.
    // Let's just set the tokens.
    try {
      await VinaraaPlayer.setAuth({ accessToken: data.tokens.accessToken, refreshToken: data.tokens.refreshToken });
      await Preferences.set({ key: 'vinaraa_refresh_token', value: data.tokens.refreshToken });
    } catch (_e) {
      localStorage.setItem('mockAccessToken', data.tokens.accessToken);
      localStorage.setItem('mockRefreshToken', data.tokens.refreshToken);
      localStorage.setItem('vinaraa_refresh_token', data.tokens.refreshToken);
    }
    return true;
  } catch {
    return false;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: z.ZodType<T>
): Promise<T> {
  const token = await getToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error('Invalid JSON response');
  }

  if (!response.ok || json.success === false) {
    if (response.status === 401 && !endpoint.startsWith('/auth')) {
      refreshing ??= refreshTokens().finally(() => (refreshing = null));
      const success = await refreshing;
      if (success) {
        return apiClient(endpoint, options, schema);
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        throw new ApiError('UNAUTHORIZED', 'Authentication required');
      }
    }
    const err = json.error || {};
    throw new ApiError(err.code || 'UNKNOWN_ERROR', err.message || response.statusText, err.details);
  }

  const data = json.data;
  
  if (schema) {
    return schema.parse(data);
  }
  return data;
}
