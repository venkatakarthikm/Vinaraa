import { WebPlugin } from '@capacitor/core';
import type { VinaraaPlayerPlugin } from './player';

const ACCESS_TOKEN_KEY = 'vinaraa_access_token';

export class VinaraaPlayerWebStub extends WebPlugin implements VinaraaPlayerPlugin {
  private audio: HTMLAudioElement | null = null;
  private currentSongId: string | null = null;

  async checkIntent(): Promise<{ openPlayer: boolean }> {
    return { openPlayer: false };
  }

  async isOnline(): Promise<{ isOnline: boolean }> {
    return { isOnline: navigator.onLine };
  }

  async setAuth({ accessToken }: { accessToken: string }): Promise<void> {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  async getAccessToken(): Promise<{ token: string | null }> {
    return { token: localStorage.getItem(ACCESS_TOKEN_KEY) };
  }

  async setConfig(_options: { apiBase: string; deviceId: string }): Promise<void> {}
  async setPlaybackContext(_options: { source?: string; contextId?: string }): Promise<void> {}

  private setupAudioListeners(audio: HTMLAudioElement) {
    audio.addEventListener('timeupdate', () => {
      if (this.currentSongId) {
        this.notifyListeners('progress', {
          songId: this.currentSongId,
          positionMs: Math.round((audio.currentTime || 0) * 1000),
          durationMs: Math.round((audio.duration || 0) * 1000),
          bufferedMs: 0,
        });
      }
    });

    audio.addEventListener('play', () => {
      this.notifyListeners('playbackStateChanged', { isPlaying: true, songId: this.currentSongId });
    });

    audio.addEventListener('pause', () => {
      this.notifyListeners('playbackStateChanged', { isPlaying: false, songId: this.currentSongId });
    });

    audio.addEventListener('ended', () => {
      this.notifyListeners('playbackStateChanged', { type: 'ended', isPlaying: false, songId: this.currentSongId });
    });

    audio.addEventListener('error', (e) => {
      console.warn('[VinaraaPlayer Web] Audio Error:', e);
      this.notifyListeners('error', { error: 'Network or playback error' });
    });
  }

  async play({ songId, streamUrl, title: _title, artist: _artist }: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }): Promise<void> {
    this.currentSongId = songId;
    if (this.audio) { this.audio.pause(); this.audio = null; }
    this.audio = new Audio(streamUrl);
    this.setupAudioListeners(this.audio);
    this.audio.play().catch((err) => {
      console.warn('[VinaraaPlayer Web] Could not autoplay:', err.message);
    });
  }

  async setQueue({ items, startIndex, positionMs, play = true }: { items: { songId: string; streamUrl: string; title: string; artist: string; artwork?: string }[]; startIndex: number; repeatMode: string; positionMs?: number; play?: boolean }): Promise<void> {
    const item = items[startIndex];
    if (item) {
      this.currentSongId = item.songId;
      if (this.audio) { this.audio.pause(); this.audio = null; }
      this.audio = new Audio(item.streamUrl);
      this.setupAudioListeners(this.audio);
      if (positionMs) this.audio.currentTime = positionMs / 1000;
      if (play) {
        this.audio.play().catch((err) => console.warn('[VinaraaPlayer Web] Could not autoplay:', err.message));
      }
    }
  }

  async insertNext(_options: { item: any }): Promise<void> {}
  async appendItems(_options: { items: any[] }): Promise<void> {}
  async removeAt(_options: { index: number }): Promise<void> {}
  async moveItem(_options: { from: number; to: number }): Promise<void> {}
  async skipToIndex(_options: { index: number }): Promise<void> {}
  async setShuffle(_options: { shuffle: boolean }): Promise<void> {}
  async getQueue(): Promise<{ currentIndex: number; items: string[] }> { return { currentIndex: 0, items: [] }; }
  async clear(): Promise<void> {}
  async appReady(): Promise<void> {}

  async pause(): Promise<void> {
    this.audio?.pause();
  }

  async resume(): Promise<void> {
    if (this.audio && this.audio.error) {
      const src = this.audio.src;
      const time = this.audio.currentTime;
      this.audio = new Audio(src);
      this.audio.currentTime = time;
      this.setupAudioListeners(this.audio);
    }
    await this.audio?.play();
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

  async setRepeatMode({ mode }: { mode: string }): Promise<void> {
    if (this.audio) {
      this.audio.loop = (mode === 'one');
    }
  }

  async next(): Promise<void> {}
  async previous(): Promise<void> {}
  async setVolume({ volume }: { volume: number }): Promise<void> {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  async download({ url, title, fileName }: { url: string; title?: string; fileName?: string }): Promise<{ downloadId: number }> {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || title || 'download.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { downloadId: 1 };
  }

  async requestPermissions(_options?: { notifications?: boolean; media?: boolean }): Promise<{ notifications: string; mediaAudio: string }> {
    return { notifications: 'granted', mediaAudio: 'granted' };
  }
}
