import { openDB } from 'idb';

const DB_NAME = 'vinaraa-lyrics-cache';
const STORE_NAME = 'lyrics';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function getCachedLyrics(songId: string) {
  const db = await getDB();
  return db.get(STORE_NAME, songId);
}

export async function setCachedLyrics(songId: string, lyrics: any) {
  const db = await getDB();
  return db.put(STORE_NAME, lyrics, songId);
}

export async function fetchLrclib(songName: string, artistName: string, durationMs: number, abortSignal?: AbortSignal) {
  const name = songName.replace(/\s*[\(\[].*?[\)\]]/g, '');
  const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(name)}&artist_name=${encodeURIComponent(artistName)}`;
  const res = await fetch(url, { signal: abortSignal });
  if (!res.ok) throw new Error('Lyrics search failed');
  const data = await res.json();
  
  // Prefer hits where duration matches within 3 seconds
  let hit = data.find((x: any) => {
    if (!x.duration) return false;
    const diff = Math.abs(x.duration * 1000 - durationMs);
    return diff <= 3000 && (x.syncedLyrics || x.plainLyrics);
  });

  // Fallback to any hit
  if (!hit) {
    hit = data.find((x: any) => x.syncedLyrics) || data.find((x: any) => x.plainLyrics);
  }

  if (hit) {
    if (hit.syncedLyrics) {
      const parsed = hit.syncedLyrics.split('\n').map((l: string) => {
        const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
        return m ? { t: +m[1] * 60 + +m[2], x: m[3].trim() || '♪' } : null;
      }).filter(Boolean);
      return { type: 'synced', lines: parsed };
    } else {
      return { type: 'plain', lyrics: hit.plainLyrics };
    }
  }
  return null;
}
