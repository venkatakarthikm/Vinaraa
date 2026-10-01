// VinaraaPlayer.ts - Capacitor plugin bridge for native Android player
import { registerPlugin } from '@capacitor/core';

export interface VinaraaPlayerPlugin {
  /** Set auth tokens (called after login/refresh) */
  setAuth(options: { accessToken: string; refreshToken: string }): Promise<void>;
  /** Get current access token */
  getAccessToken(): Promise<{ token: string | null; refreshToken?: string | null }>;
  /** Start playing a stream URL */
  play(options: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }): Promise<void>;
  /** Set full queue natively in ExoPlayer */
  setQueue(options: {
    items: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }[];
    startIndex: number;
    repeatMode: string;
  }): Promise<void>;
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
  addListener(eventName: 'playbackStateChanged' | 'songChanged' | 'error' | 'nextTrack' | 'previousTrack', listenerFunc: (event: any) => void): Promise<{ remove: () => void }>;
  /** Download song natively */
  download(options: { url: string; title?: string; fileName?: string }): Promise<{ downloadId: number }>;
}

/**
 * VinaraaPlayer - native Capacitor plugin for ExoPlayer/Media3.
 * Falls back to a web stub when running in browser or during development.
 */
const VinaraaPlayerNative = registerPlugin<VinaraaPlayerPlugin>('VinaraaPlayer', {
  web: () => import('./playerWebStub').then((m) => new m.VinaraaPlayerWebStub()),
});

export const VinaraaPlayer = VinaraaPlayerNative;
