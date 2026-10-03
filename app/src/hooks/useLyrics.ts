// app/src/hooks/useLyrics.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLyrics, type ParsedLyrics } from '@/utils/lyrics';

export interface LyricsSong {
  id: string;
  name: string;
  artistsText?: string;
  album?: { name?: string } | string | null;
  durationMs?: number;
}

type Status = 'loading' | 'ready' | 'empty' | 'error';

interface State {
  key: string | null; // the song id this state belongs to
  status: Status;
  data: ParsedLyrics | null;
}

const memory = new Map<string, ParsedLyrics | null>();
const LS_PREFIX = 'vinaraa:lyrics:v2:';

function readCache(id: string): ParsedLyrics | null | undefined {
  if (memory.has(id)) return memory.get(id);
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (raw) {
      const parsed = JSON.parse(raw) as ParsedLyrics;
      memory.set(id, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function writeCache(id: string, data: ParsedLyrics | null) {
  memory.set(id, data);
  if (!data) return; // "not found" is only cached in memory (a match may appear later)
  try {
    localStorage.setItem(LS_PREFIX + id, JSON.stringify(data));
  } catch {
    /* storage full: ignore */
  }
}

export function useLyrics(song: LyricsSong | null | undefined) {
  const id = song?.id ?? null;
  const [state, setState] = useState<State>({ key: null, status: 'loading', data: null });
  const [nonce, setNonce] = useState(0);
  const songRef = useRef(song);
  songRef.current = song;
  const forceRef = useRef(false); // set by retry(): skip the cache once

  useEffect(() => {
    if (!id) {
      setState({ key: null, status: 'empty', data: null });
      return;
    }

    const cached = forceRef.current ? undefined : readCache(id);
    forceRef.current = false;
    if (cached !== undefined) {
      setState({ key: id, status: cached ? 'ready' : 'empty', data: cached });
      return;
    }

    // Reset immediately so the previous song's lyrics can never be shown.
    setState({ key: id, status: 'loading', data: null });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const s = songRef.current!;

    fetchLyrics(
      {
        title: s.name,
        artist: s.artistsText || '',
        album: typeof s.album === 'string' ? s.album : s.album?.name,
        durationMs: s.durationMs,
      },
      ctrl.signal,
    )
      .then((data) => {
        writeCache(id, data);
        setState({ key: id, status: data ? 'ready' : 'empty', data });
      })
      .catch((e: Error) => {
        // aborted because the song changed -> a newer request owns the state
        if (e.name === 'AbortError' && songRef.current?.id !== id) return;
        setState({ key: id, status: 'error', data: null });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [id, nonce]);

  const retry = useCallback(() => {
    if (id) memory.delete(id);
    forceRef.current = true;
    setNonce((n) => n + 1);
  }, [id]);

  // Never expose another song's state.
  const current: State =
    state.key === id ? state : { key: id, status: 'loading', data: null };

  return { status: current.status, data: current.data, retry };
}