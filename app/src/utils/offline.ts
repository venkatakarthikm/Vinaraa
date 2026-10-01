import { Preferences } from '@capacitor/preferences';

const DOWNLOADS_KEY = 'vinaraa_downloaded_songs';

export interface OfflineSong {
  id: string;
  name: string;
  artist: string;
  image?: string;
  durationMs?: number;
  streamUrl: string;
  localPath?: string;
  downloadedAt: number;
}

export async function getDownloadedSongs(): Promise<OfflineSong[]> {
  try {
    const { value } = await Preferences.get({ key: DOWNLOADS_KEY });
    if (!value) return [];
    return JSON.parse(value);
  } catch (_e) {
    return [];
  }
}

export async function saveDownloadedSong(song: OfflineSong): Promise<void> {
  const current = await getDownloadedSongs();
  const existingIndex = current.findIndex((s) => s.id === song.id);
  if (existingIndex >= 0) {
    current[existingIndex] = song;
  } else {
    current.unshift(song);
  }
  await Preferences.set({ key: DOWNLOADS_KEY, value: JSON.stringify(current) });
}

export async function removeDownloadedSong(songId: string): Promise<void> {
  const current = await getDownloadedSongs();
  const updated = current.filter((s) => s.id !== songId);
  await Preferences.set({ key: DOWNLOADS_KEY, value: JSON.stringify(updated) });
}

export function isOnline(): boolean {
  return navigator.onLine;
}
