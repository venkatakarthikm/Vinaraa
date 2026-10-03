import { registerPlugin } from '@capacitor/core';

export interface VinaraaPlayerPlugin {
  checkIntent(): Promise<{ openPlayer: boolean }>;
  isOnline(): Promise<{ isOnline: boolean }>;
  setAuth(options: { accessToken: string }): Promise<void>;
  getAccessToken(): Promise<{ token: string | null }>;
  setConfig(options: { apiBase: string; deviceId: string }): Promise<void>;
  setPlaybackContext(options: { source?: string; contextId?: string }): Promise<void>;
  play(options: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }): Promise<void>;
  setQueue(options: {
    items: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }[];
    startIndex: number;
    repeatMode: string;
    positionMs?: number;
    play?: boolean;
  }): Promise<void>;
  insertNext(options: { item: any }): Promise<void>;
  appendItems(options: { items: any[] }): Promise<void>;
  removeAt(options: { index: number }): Promise<void>;
  moveItem(options: { from: number; to: number }): Promise<void>;
  skipToIndex(options: { index: number }): Promise<void>;
  setShuffle(options: { shuffle: boolean }): Promise<void>;
  getQueue(): Promise<{ currentIndex: number; items: string[] }>;
  clear(): Promise<void>;
  appReady(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seekTo(options: { positionMs: number }): Promise<void>;
  getState(): Promise<{
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;
    bufferedMs: number;
    songId: string | null;
  }>;
  setRepeatMode(options: { mode: string }): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  addListener(eventName: 'playbackStateChanged' | 'songChanged' | 'error' | 'nextTrack' | 'previousTrack' | 'progress', listenerFunc: (event: any) => void): Promise<{ remove: () => void }>;
  download(options: { url: string; title?: string; fileName?: string }): Promise<{ downloadId: number; status?: string; path?: string; streamUrl?: string }>;
  requestPermissions(options?: { notifications?: boolean; media?: boolean }): Promise<{ notifications: string; mediaAudio: string }>;
}

const VinaraaPlayerNative = registerPlugin<VinaraaPlayerPlugin>('VinaraaPlayer', {
  web: () => import('./playerWebStub').then((m) => new m.VinaraaPlayerWebStub()),
});

export const VinaraaPlayer = VinaraaPlayerNative;
