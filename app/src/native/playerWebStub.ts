// Web stub for VinaraaPlayer plugin — runs in browser/Capacitor web fallback
import { WebPlugin } from '@capacitor/core';
import type { VinaraaPlayerPlugin } from './player';

const ACCESS_TOKEN_KEY = 'vinaraa_access_token';
const REFRESH_TOKEN_KEY = 'vinaraa_refresh_token';

export class VinaraaPlayerWebStub extends WebPlugin implements VinaraaPlayerPlugin {
  private audio: HTMLAudioElement | null = null;
  private currentSongId: string | null = null;

  async setAuth({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }): Promise<void> {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  async getAccessToken(): Promise<{ token: string | null }> {
    return { token: localStorage.getItem(ACCESS_TOKEN_KEY) };
  }

  async play({ songId, streamUrl, title: _title, artist: _artist }: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }): Promise<void> {
    this.currentSongId = songId;
    if (this.audio) { this.audio.pause(); this.audio = null; }
    this.audio = new Audio(streamUrl);
    this.audio.play().catch((err) => {
      console.warn('[VinaraaPlayer Web] Could not autoplay:', err.message);
    });
    this.notifyListeners('playbackStateChanged', { isPlaying: true, songId });
  }

  async pause(): Promise<void> {
    this.audio?.pause();
    this.notifyListeners('playbackStateChanged', { isPlaying: false, songId: this.currentSongId });
  }

  async resume(): Promise<void> {
    await this.audio?.play();
    this.notifyListeners('playbackStateChanged', { isPlaying: true, songId: this.currentSongId });
  }

  async stop(): Promise<void> {
    if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; this.audio = null; }
    this.currentSongId = null;
  }

  async seekTo({ positionMs }: { positionMs: number }): Promise<void> {
    if (this.audio) this.audio.currentTime = positionMs / 1000;
  }

  async getState(): Promise<{ isPlaying: boolean; positionMs: number; durationMs: number; bufferedMs: number; songId: string | null }> {
    return {
      isPlaying: this.audio ? !this.audio.paused : false,
      positionMs: this.audio ? this.audio.currentTime * 1000 : 0,
      durationMs: this.audio ? (this.audio.duration || 0) * 1000 : 0,
      bufferedMs: 0,
      songId: this.currentSongId,
    };
  }

  async next(): Promise<void> {}
  async previous(): Promise<void> {}
  async setVolume({ volume }: { volume: number }): Promise<void> {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, volume));
  }
}
