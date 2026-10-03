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

export async function fetchLrclib(
  songName: string,
  artistName: string,
  durationMs: number,
  abortSignal?: AbortSignal
) {
  const cleanTitle = songName
    .replace(/\(From\s+"[^"]*"\)/gi, '')
    .replace(/\((?:Telugu|Hindi|Tamil|Kannada|Malayalam|Bengali|Marathi|Punjabi|Gujarati|Odia|Bhojpuri|English)\)/gi, '')
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const primaryArtist = (artistName || '').split(',')[0].trim();

  const searchLrclib = async (titleToSearch: string) => {
    const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(titleToSearch)}&artist_name=${encodeURIComponent(primaryArtist)}`;
    const res = await fetch(url, {
      signal: abortSignal,
      headers: { 'user-agent': 'Vinaraa/1.0 (https://vinaraa.onrender.com)' },
    });
    if (!res.ok) return null;
    return res.json();
  };

  let data = await searchLrclib(cleanTitle || songName).catch(() => null);

  if ((!Array.isArray(data) || !data.length) && cleanTitle !== songName) {
    data = await searchLrclib(songName).catch(() => null);
  }

  if (!Array.isArray(data) || !data.length) return null;

  let hit = data.find((x: any) => {
    if (!x.duration || !durationMs) return false;
    const diff = Math.abs(x.duration * 1000 - durationMs);
    return diff <= 3000 && (x.syncedLyrics || x.plainLyrics);
  });

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
    } else if (hit.plainLyrics) {
      const lines = hit.plainLyrics
        .split('\n')
        .map((x: string) => x.trim())
        .filter(Boolean)
        .map((x: string) => ({ t: 0, x }));
      return { type: 'plain', lines, lyrics: hit.plainLyrics };
    }
  }
  return null;
}
