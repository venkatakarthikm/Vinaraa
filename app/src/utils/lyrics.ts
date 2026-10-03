// app/src/utils/lyrics.ts
// Pure helpers: LRC parsing, active-line search, LRCLIB fetch + best-match ranking.
// All times are in MILLISECONDS everywhere in this file.

export interface LyricLine {
  /** start time in ms. -1 means "unsynced line" (plain text, never highlighted) */
  timeMs: number;
  text: string;
}

export interface ParsedLyrics {
  synced: boolean;
  lines: LyricLine[];
  source: 'lrclib';
}

export interface LyricsQuery {
  title: string;
  artist: string;
  album?: string;
  /** song duration in ms (optional, but strongly improves matching) */
  durationMs?: number;
}

/* ------------------------------------------------------------------ */
/* LRC parsing                                                         */
/* ------------------------------------------------------------------ */

const TIME_TAG_G = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG_G = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g; // enhanced-LRC word tags
const OFFSET_TAG = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i;
const META_TAG = /^\s*\[(?:ar|ti|al|au|by|length|re|ve|la|#)\s*:.*\]\s*$/i;

function fractionToMs(frac: string | undefined): number {
  if (!frac) return 0;
  if (frac.length === 1) return Number(frac) * 100;
  if (frac.length === 2) return Number(frac) * 10; // centiseconds (most common)
  return Number(frac.slice(0, 3)); // milliseconds
}

export function parseLrc(raw: string): ParsedLyrics {
  const rows = (raw || '').replace(/\r\n?/g, '\n').split('\n');

  let offsetMs = 0;
  const timed: { timeMs: number; text: string; order: number }[] = [];
  const plain: string[] = [];
  let order = 0;

  for (const row of rows) {
    const off = row.match(OFFSET_TAG);
    if (off) {
      offsetMs = Number(off[1]) || 0;
      continue;
    }
    if (META_TAG.test(row)) continue;

    const stamps: number[] = [];
    for (const m of row.matchAll(TIME_TAG_G)) {
      stamps.push(Number(m[1]) * 60_000 + Number(m[2]) * 1000 + fractionToMs(m[3]));
    }
    const clean = row
      .replace(TIME_TAG_G, '')
      .replace(WORD_TAG_G, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (stamps.length) {
      for (const s of stamps) timed.push({ timeMs: s, text: clean, order: order++ });
    } else if (clean) {
      plain.push(clean);
    }
  }

  if (timed.length) {
    timed.sort((a, b) => a.timeMs - b.timeMs || a.order - b.order);
    // LRC "offset": a positive value means lyrics should appear EARLIER
    const lines: LyricLine[] = timed.map((t) => ({
      timeMs: Math.max(0, t.timeMs - offsetMs),
      text: t.text,
    }));
    while (lines.length && !lines[lines.length - 1].text) lines.pop(); // trailing blanks
    return { synced: lines.length > 0, lines, source: 'lrclib' };
  }

  return {
    synced: false,
    lines: plain.map((t) => ({ timeMs: -1, text: t })),
    source: 'lrclib',
  };
}

/**
 * Index of the line active at `positionMs` = last line whose start <= position.
 * Returns -1 before the first line, or when the lyrics are not synced.
 * (Binary search, O(log n).)
 */
export function findActiveIndex(lines: LyricLine[], positionMs: number): number {
  if (!lines.length || !Number.isFinite(positionMs) || lines[0].timeMs < 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/* ------------------------------------------------------------------ */
/* Matching helpers                                                    */
/* ------------------------------------------------------------------ */

/** `Naa Ready (From "Leo")` -> `Naa Ready` */
export function cleanTitle(name: string): string {
  return (name || '')
    .replace(/\s*[(\[][^)\]]*[)\]]/g, '')
    .replace(/\s*-\s*(from|feat|ft)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function firstArtist(artistsText: string): string {
  return (artistsText || '').split(/,|&|\sfeat\.?\s|\sft\.?\s|\sand\s/i)[0].trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    (s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => {
    if (B.has(t)) inter++;
  });
  return inter / (A.size + B.size - inter);
}

interface LrclibItem {
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number; // seconds
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function score(item: LrclibItem, q: LyricsQuery): number {
  if (item.instrumental) return -10;
  if (!item.syncedLyrics && !item.plainLyrics) return -10;
  let s = similarity(cleanTitle(item.trackName || ''), cleanTitle(q.title)) * 2.5;
  s += similarity(item.artistName || '', q.artist) * 1.2;
  if (q.album) s += similarity(item.albumName || '', q.album) * 0.4;
  if (item.syncedLyrics) s += 1;
  if (q.durationMs && item.duration) {
    const diff = Math.abs(item.duration - q.durationMs / 1000);
    if (diff <= 2) s += 1.2;
    else if (diff <= 5) s += 0.5;
    else if (diff > 12) s -= 2.5; // almost certainly a different recording
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* LRCLIB fetch                                                        */
/* ------------------------------------------------------------------ */

const BASE = 'https://lrclib.net/api';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return (await res.json()) as T;
}

function toParsed(item: LrclibItem): ParsedLyrics | null {
  if (item.syncedLyrics) {
    const p = parseLrc(item.syncedLyrics);
    if (p.synced) return p;
  }
  if (item.plainLyrics) {
    const p = parseLrc(item.plainLyrics);
    if (p.lines.length) return { ...p, synced: false };
  }
  return null;
}

export async function fetchLyrics(
  q: LyricsQuery,
  signal?: AbortSignal,
): Promise<ParsedLyrics | null> {
  const title = cleanTitle(q.title);
  const artist = firstArtist(q.artist);
  const qs = (o: Record<string, string | number | undefined>) =>
    Object.entries(o)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');

  const candidates: LrclibItem[] = [];

  // 1) exact lookup
  try {
    const exact = await getJson<LrclibItem>(
      `${BASE}/get?${qs({
        track_name: title,
        artist_name: artist,
        album_name: q.album,
        duration: q.durationMs ? Math.round(q.durationMs / 1000) : undefined,
      })}`,
      signal,
    );
    if (exact) candidates.push(exact);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
  }

  // 2) structured search, then 3) free-text search
  if (!candidates.some((c) => c.syncedLyrics)) {
    for (const url of [
      `${BASE}/search?${qs({ track_name: title, artist_name: artist })}`,
      `${BASE}/search?${qs({ q: `${title} ${artist}`.trim() })}`,
    ]) {
      try {
        const list = await getJson<LrclibItem[]>(url, signal);
        if (list?.length) candidates.push(...list);
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
      }
      if (candidates.some((c) => c.syncedLyrics)) break;
    }
  }

  const ranked = candidates
    .map((c) => ({ c, s: score(c, { ...q, title, artist }) }))
    .filter((x) => x.s >= 1.6) // reject weak / different songs
    .sort((a, b) => b.s - a.s);

  for (const { c } of ranked) {
    const parsed = toParsed(c);
    if (parsed) return parsed;
  }
  return null;
}