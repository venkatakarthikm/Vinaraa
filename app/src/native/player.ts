// VinaraaPlayer.ts - Capacitor plugin bridge for native Android player
import { registerPlugin } from '@capacitor/core';

export interface VinaraaPlayerPlugin {
  /** Check if app was opened from media notification */
  checkIntent(): Promise<{ openPlayer: boolean }>;
  /** Check if active internet connection is available */
  isOnline(): Promise<{ isOnline: boolean }>;
  /** Set auth tokens (called after login/refresh) */
  setAuth(options: { accessToken: string }): Promise<void>;
  /** Get current access token */
  getAccessToken(): Promise<{ token: string | null }>;
  /** Set tracking configuration */
  setConfig(options: { apiBase: string; deviceId: string }): Promise<void>;
  /** Set playback context (source/contextId) for tracking */
  setPlaybackContext(options: { source?: string; contextId?: string }): Promise<void>;
  /** Start playing a stream URL */
  play(options: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }): Promise<void>;
  /** Set full queue natively in ExoPlayer */
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
  /** Pause playback */
  pause(): Promise<void>;
  /** Resume playback */
  resume(): Promise<void>;
  /** Stop and clear queue */
  stop(): Promise<void>;
  /** Seek to position in ms */
  seekTo(options: { positionMs: number }): Promise<void>;
  /** Get current playback state */
  getState(): Promise<{
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;
    bufferedMs: number;
    songId: string | null;
  }>;
  /** Set repeat mode (off, all, one) */
  setRepeatMode(options: { mode: string }): Promise<void>;
  /** Skip to next in queue */
  next(): Promise<void>;
  /** Skip to previous in queue */
  previous(): Promise<void>;
  /** Set volume 0.0-1.0 */
  setVolume(options: { volume: number }): Promise<void>;
  /** Add event listener for player events */
  addListener(eventName: 'playbackStateChanged' | 'songChanged' | 'error' | 'nextTrack' | 'previousTrack' | 'progress', listenerFunc: (event: any) => void): Promise<{ remove: () => void }>;
  /** Download song natively */
  download(options: { url: string; title?: string; fileName?: string }): Promise<{ downloadId: number; status?: string; path?: string; streamUrl?: string }>;
}

/**
 * VinaraaPlayer - native Capacitor plugin for ExoPlayer/Media3.
 * Falls back to a web stub when running in browser or during development.
 */
const VinaraaPlayerNative = registerPlugin<VinaraaPlayerPlugin>('VinaraaPlayer', {
  web: () => import('./playerWebStub').then((m) => new m.VinaraaPlayerWebStub()),
});

export const VinaraaPlayer = VinaraaPlayerNative;
