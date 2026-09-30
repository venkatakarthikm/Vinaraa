import { z } from 'zod';
import { VinaraaPlayer } from '@/native/player';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

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
    const err = json.error || {};
    throw new ApiError(err.code || 'UNKNOWN_ERROR', err.message || response.statusText, err.details);
  }

  const data = json.data;
  
  if (schema) {
    return schema.parse(data);
  }
  return data;
}
