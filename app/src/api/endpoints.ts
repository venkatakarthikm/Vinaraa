import { apiClient, API_BASE } from './client';

// ── Auth ───────────────────────────────────────────────────────────────────
export const auth = {
  register: (body: {
    name: string;
    email: string;
    password: string;
    device: { deviceId: string; platform: string; model?: string; appVersion?: string };
  }) => apiClient<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: {
    email: string;
    password: string;
    device: { deviceId: string; platform: string; model?: string; appVersion?: string };
  }) => apiClient<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  logout: (refreshToken: string) =>
    apiClient<any>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  logoutAll: () => apiClient<any>('/auth/logout-all', { method: 'POST' }),

  forgotPassword: (email: string) =>
    apiClient<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (body: { token: string; email: string; newPassword: string }) =>
    apiClient<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiClient<any>('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),

  sessions: () => apiClient<any>('/auth/sessions'),

  deleteSession: (deviceId: string) =>
    apiClient<any>(`/auth/sessions/${deviceId}`, { method: 'DELETE' }),
};

// ── Users ──────────────────────────────────────────────────────────────────
export const users = {
  me: () => apiClient<any>('/users/me'),
  updateMe: (body: any) => apiClient<any>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  updatePreferences: (body: any) => apiClient<any>('/users/me/preferences', { method: 'PATCH', body: JSON.stringify(body) }),
  setTasteSeeds: (body: any) => apiClient<any>('/users/me/taste-seeds', { method: 'PUT', body: JSON.stringify(body) }),
  registerDevice: (body: any) => apiClient<any>('/users/me/devices', { method: 'POST', body: JSON.stringify(body) }),
  searchHistory: () => apiClient<any>('/users/me/search-history'),
  addSearchHistory: (body: any) => apiClient<any>('/users/me/search-history', { method: 'POST', body: JSON.stringify(body) }),
  clearSearchHistory: () => apiClient<any>('/users/me/search-history', { method: 'DELETE' }),
  deleteSearchHistoryItem: (query: string) => apiClient<any>(`/users/me/search-history/${encodeURIComponent(query)}`, { method: 'DELETE' }),
  exportData: () => apiClient<any>('/users/me/export'),
  deleteAccount: () => apiClient<any>('/users/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),
};

// ── Onboarding ─────────────────────────────────────────────────────────────
export const onboarding = {
  bundle: (language?: string) => apiClient<any>(`/onboarding/bundle${language ? `?language=${language}` : ''}`),
  options: (params: { type: string; language?: string; q?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiClient<any>(`/onboarding/options?${qs}`);
  },
  languages: () => apiClient<any>('/onboarding/languages'),
  status: () => apiClient<any>('/onboarding/status'),
  complete: (body: any) => apiClient<any>('/onboarding/complete', { method: 'POST', body: JSON.stringify(body) }),
};

// ── Music ──────────────────────────────────────────────────────────────────
export const music = {
  search: (params: { q: string; type?: string; page?: number; limit?: number; language?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiClient<any>(`/music/search?${qs}`);
  },
  suggestions: (q: string) => apiClient<any>(`/music/search/suggestions?q=${encodeURIComponent(q)}`),
  song: (id: string) => apiClient<any>(`/music/songs/${id}`),
  songs: (ids: string[]) => apiClient<any>(`/music/songs?ids=${ids.join(',')}`),
  lyrics: (id: string) => apiClient<any>(`/music/songs/${id}/lyrics`),
  similar: (id: string) => apiClient<any>(`/music/songs/${id}/similar`),
  album: (id: string) => apiClient<any>(`/music/albums/${id}`),
  artist: (id: string) => apiClient<any>(`/music/artists/${id}`),
  editorialPlaylist: (id: string) => apiClient<any>(`/music/editorial/playlists/${id}`),
  modules: (languages?: string) => apiClient<any>(`/music/modules${languages ? `?languages=${languages}` : ''}`),
  trending: (language?: string) => apiClient<any>(`/music/trending${language ? `?language=${language}` : ''}`),
  languages: () => apiClient<any>('/music/languages'),
  streamUrl: (id: string, quality?: string, mode?: 'proxy' | 'redirect') => {
    const qs = new URLSearchParams({ ...(quality && { quality }), mode: mode || 'redirect' }).toString();
    return `${API_BASE}/music/stream/${id}?${qs}`;
  },
};

// ── Playlists ──────────────────────────────────────────────────────────────
export const playlists = {
  list: () => apiClient<any>('/playlists'),
  create: (body: { name?: string; visibility?: 'private' | 'unlisted' | 'public' }) => apiClient<any>('/playlists', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => apiClient<any>(`/playlists/${id}`),
  update: (id: string, body: any) => apiClient<any>(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => apiClient<any>(`/playlists/${id}`, { method: 'DELETE' }),
  addTrack: (id: string, body: { songIds: string[]; source?: string; position?: number }) => apiClient<any>(`/playlists/${id}/tracks`, { method: 'POST', body: JSON.stringify(body) }),
  removeTrack: (id: string, body: { songIds: string[] }) => apiClient<any>(`/playlists/${id}/tracks`, { method: 'DELETE', body: JSON.stringify(body) }),
  reorder: (id: string, body: { from: number; to: number }) => apiClient<any>(`/playlists/${id}/reorder`, { method: 'PATCH', body: JSON.stringify(body) }),
  saveSong: (body: { songId: string; playlistIds?: string[]; newPlaylistName?: string }) =>
    apiClient<any>('/playlists/save-song', { method: 'POST', body: JSON.stringify(body) }),
  nameSuggestion: () => apiClient<any>('/playlists/name-suggestion'),
  like: (songId: string, liked?: boolean) =>
    apiClient<any>('/playlists/liked', { method: 'POST', body: JSON.stringify({ songId, ...(liked !== undefined && { liked }) }) }),
  isLiked: (songId: string) => apiClient<any>(`/playlists/liked/${songId}`),
  system: () => apiClient<any>('/playlists/system'),
  duplicate: (id: string) => apiClient<any>(`/playlists/${id}/duplicate`, { method: 'POST' }),
  play: (id: string) => apiClient<any>(`/playlists/${id}/play`, { method: 'POST' }),
  refreshTasteMix: () => apiClient<any>('/playlists/system/taste-mix/refresh', { method: 'POST' }),
  refreshOnRepeat: () => apiClient<any>('/playlists/system/on-repeat/refresh', { method: 'POST' }),
};

// ── Recommendations ────────────────────────────────────────────────────────
export const recommendations = {
  feed: () => apiClient<any>('/recommendations/feed'),
  forYou: (params?: { limit?: number; language?: string }) => {
    const qs = params ? new URLSearchParams(params as any).toString() : '';
    return apiClient<any>(`/recommendations/for-you${qs ? `?${qs}` : ''}`);
  },
  next: (currentSongId: string) => apiClient<any>(`/recommendations/next?currentSongId=${currentSongId}`),
  entity: (type: string, id: string) => apiClient<any>(`/recommendations/entity/${type}/${id}`),
  tasteProfile: () => apiClient<any>('/recommendations/taste-profile'),
};

// ── Tracking ───────────────────────────────────────────────────────────────
export const tracking = {
  startSession: (songId: string) =>
    apiClient<any>('/tracking/sessions', { method: 'POST', body: JSON.stringify({ songId }) }),
  heartbeat: (sessionId: string, body: { positionMs: number; state: 'playing' | 'paused' | 'buffering' }) =>
    apiClient<any>(`/tracking/sessions/${sessionId}/heartbeat`, { method: 'POST', body: JSON.stringify(body) }),
  endSession: (sessionId: string, positionMs: number) =>
    apiClient<any>(`/tracking/sessions/${sessionId}/end`, { method: 'POST', body: JSON.stringify({ positionMs }) }),
  event: (sessionId: string, body: any) =>
    apiClient<any>(`/tracking/sessions/${sessionId}/events`, { method: 'POST', body: JSON.stringify(body) }),
  sync: (body: any) => apiClient<any>('/tracking/sync', { method: 'POST', body: JSON.stringify(body) }),
};

// ── Stats ──────────────────────────────────────────────────────────────────
export const stats = {
  dashboard: (range?: string) => apiClient<any>(`/stats/dashboard${range ? `?range=${range}` : ''}`),
  insights: (range?: string) => apiClient<any>(`/stats/insights${range ? `?range=${range}` : ''}`),
  sessions: (params?: any) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiClient<any>(`/stats/history/sessions${qs ? `?${qs}` : ''}`);
  },
};

// ── Notifications ──────────────────────────────────────────────────────────
export const notifications = {
  registerDevice: (body: any) => apiClient<any>('/notifications/register', { method: 'POST', body: JSON.stringify(body) }),
};
