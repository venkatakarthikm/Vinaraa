import { z } from 'zod';
import { VinaraaPlayer } from '@/native/player';
import { useAuthStore } from '@/store/auth';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://vinaraa.onrender.com/api/v1';

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

async function doFetch(fullUrl: string, options: RequestInit & { headers: Headers }, attempt = 1): Promise<Response> {
  try {
    return await fetch(fullUrl, options);
  } catch (err: any) {
    // Retry up to 2 times on network-level failures (Android WebView bridge issues)
    if (attempt < 3 && (err?.message === 'Failed to fetch' || err?.message === 'Network request failed')) {
      const delay = attempt * 1000;
      console.warn(`[API Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      return doFetch(fullUrl, options, attempt + 1);
    }
    throw err;
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

  const fullUrl = `${API_BASE}${endpoint}`;
  console.log(`[API Request] ${options.method || 'GET'} ${fullUrl}`, options.body || '');

  try {
    const response = await doFetch(fullUrl, { ...options, headers });

    const text = await response.text();
    console.log(`[API Response] ${response.status} ${fullUrl}`, text);

    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok || json.success === false) {
      const err = json.error || {};
      if (response.status === 401 && ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'SESSION_REVOKED'].includes(err.code)) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      throw new ApiError(err.code || 'UNKNOWN_ERROR', err.message || response.statusText, err.details);
    }

    const data = json.data;

    if (schema) {
      return schema.parse(data);
    }
    return data;
  } catch (err: any) {
    console.error(`[API Fetch Failed] ${options.method || 'GET'} ${fullUrl}`, err?.message || err);
    throw err;
  }
}
