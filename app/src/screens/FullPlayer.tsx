import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/player';
import { tracking, music } from '@/api/endpoints';
import {
  ChevronDown, Heart, MoreHorizontal, SkipBack, SkipForward,
  Play, Pause, Shuffle, Repeat, Repeat1, Share2, ListMusic, Download
} from 'lucide-react';
import { springs } from '@/motion';

type PlayerTab = 'photo' | 'lyrics' | 'info';

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function FullPlayer() {
  const {
    isPlaying, positionMs, durationMs,
    repeat, shuffle, setPlaying, setPosition, nextTrack, previousTrack,
    setRepeat, setShuffle, setShowPlayer, sessionId, setSessionId, currentSong
  } = usePlayerStore();
  const navigate = useNavigate();
  const [playerTab, setPlayerTab] = useState<PlayerTab>('photo');
  const [liked, setLiked] = useState(false);
  const [lyrics, setLyrics] = useState<any>(null);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(positionMs);
  positionRef.current = positionMs;

  const song = currentSong();

  useEffect(() => {
    if (!song?.id) return;
    tracking.startSession(song.id).then((s) => setSessionId(s.sessionId)).catch(() => {});
    return () => {
      if (sessionId) tracking.endSession(sessionId, positionRef.current).catch(() => {});
    };
  }, [song?.id]);

  useEffect(() => {
    if (!sessionId) return;
    heartbeatRef.current = setInterval(() => {
      tracking.heartbeat(sessionId, { positionMs: positionRef.current, state: isPlaying ? 'playing' : 'paused' }).catch(() => {});
    }, 12000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [sessionId, isPlaying]);

  const loadLrclib = async (songName: string, artistName: string) => {
    try {
      const name = songName.replace(/\s*[\(\[].*?[\)\]]/g, '');
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(name)}&artist_name=${encodeURIComponent(artistName)}`;
      const res = await fetch(url);
      const data = await res.json();
      const hit = data.find((x: any) => x.syncedLyrics) || data.find((x: any) => x.plainLyrics);
      if (hit) {
        if (hit.syncedLyrics) {
          const parsed = hit.syncedLyrics.split('\n').map((l: string) => {
            const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
            return m ? { t: +m[1] * 60 + +m[2], x: m[3].trim() || '♪' } : null;
          }).filter(Boolean);
          setLyrics({ type: 'synced', lines: parsed });
        } else {
          setLyrics({ type: 'plain', lyrics: hit.plainLyrics });
        }
      } else {
        setLyrics({ lyrics: 'No lyrics found.' });
      }
    } catch {
      setLyrics({ lyrics: 'Lyrics unavailable.' });
    }
  };

  useEffect(() => {
    if (playerTab === 'lyrics' && song?.id && !lyrics) {
      loadLrclib(song.name, song.artist.split(',')[0]);
    }
  }, [playerTab, song?.id]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPosition(Math.min(positionRef.current + 1000, durationMs || Infinity));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, durationMs]);

  const progress = durationMs ? (seeking ? seekValue : positionMs / durationMs) : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeeking(true);
    setSeekValue(Number(e.target.value));
  };

  const handleSeekCommit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPos = Number(e.target.value) * (durationMs || 0);
    setPosition(newPos);
    setSeeking(false);
  };

  const toggleRepeat = () => {
    if (repeat === 'off') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('off');
  };

  if (!song) {
    return (
      <div className="flex flex-col h-full bg-bg items-center justify-center">
        <p className="text-muted">No song selected</p>
        <button onClick={() => { setShowPlayer(false); navigate(-1); }} className="mt-4 text-primary-soft">Go Back</button>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col h-full bg-bg"
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={springs.sheet}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2"
        style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)` }}>
        <button onClick={() => { setShowPlayer(false); navigate(-1); }} className="p-2" aria-label="Close player">
          <ChevronDown size={26} className="text-text" />
        </button>
        <p className="text-muted text-xs uppercase tracking-widest">Now Playing</p>
        <button className="p-2" aria-label="More options">
          <MoreHorizontal size={24} className="text-text" />
        </button>
      </div>

      <div className="flex mx-5 bg-surface-2 rounded-pill p-1 mb-4">
        {(['photo', 'lyrics', 'info'] as PlayerTab[]).map((tab) => (
          <button key={tab} onClick={() => setPlayerTab(tab)}
            className={`flex-1 py-2 rounded-pill text-sm font-semibold transition-all capitalize ${playerTab === tab ? 'bg-primary text-white shadow-colored' : 'text-muted'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 min-h-0">
        <AnimatePresence mode="wait">
          {playerTab === 'photo' && (
            <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full">
              <motion.div
                className="w-72 h-72 rounded-3xl overflow-hidden shadow-colored"
                animate={isPlaying ? { scale: [1, 1.01, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                {song.image ? (
                  <img src={song.image} alt={song.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <Play size={48} className="text-muted" />
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
          {playerTab === 'lyrics' && (
            <motion.div key="lyrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto scroll-y text-center py-4 px-2">
              {!lyrics ? <p className="text-muted pt-20">Loading lyrics…</p>
                : lyrics.type === 'synced' ? (
                  <div className="flex flex-col gap-3 pb-32 pt-16">
                    {lyrics.lines.map((l: any, i: number) => {
                      const isActive = (positionMs / 1000) >= l.t && (i === lyrics.lines.length - 1 || (positionMs / 1000) < lyrics.lines[i + 1].t);
                      return (
                        <p key={i} className={`text-lg font-bold transition-all duration-300 ${isActive ? 'text-primary-soft scale-110' : 'text-text/40'}`}>
                          {l.x}
                        </p>
                      );
                    })}
                  </div>
                ) : lyrics.lyrics ? (
                  <pre className="text-text/80 font-sans text-base leading-9 whitespace-pre-wrap pb-32 pt-4">{lyrics.lyrics}</pre>
                ) : <p className="text-muted pt-20">Lyrics not available</p>}
            </motion.div>
          )}
          {playerTab === 'info' && (
            <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto scroll-y py-4 flex flex-col gap-4">
              {song.album && <div><p className="text-muted text-xs mb-1">Album</p><p className="text-text font-semibold">{song.album}</p></div>}
              {song.language && <div><p className="text-muted text-xs mb-1">Language</p><p className="text-text font-semibold capitalize">{song.language}</p></div>}
              <div><p className="text-muted text-xs mb-1">Duration</p><p className="text-text font-semibold">{formatTime(durationMs)}</p></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-5 py-4 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-text text-xl font-bold leading-tight line-clamp-1">{song.name}</h2>
          <p className="text-muted text-sm line-clamp-1">{song.artist}</p>
        </div>
        <motion.button
          onClick={() => setLiked((v) => !v)}
          whileTap={{ scale: 1.35 }}
          transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
          className="p-2 ml-4 flex-shrink-0"
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={26} fill={liked ? '#FF3D8E' : 'none'} className={liked ? 'text-accent' : 'text-muted'} />
        </motion.button>
      </div>

      <div className="px-5 mb-2">
        <input
          type="range" min={0} max={1} step={0.001}
          value={seeking ? seekValue : progress}
          onChange={handleSeekChange}
          onMouseUp={handleSeekCommit as any}
          onTouchEnd={handleSeekCommit as any}
          className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #8B3DFF ${progress * 100}%, #1D1D3A ${progress * 100}%)` }}
          aria-label="Seek"
        />
        <div className="flex justify-between mt-1">
          <span className="text-muted text-xs">{formatTime(positionMs)}</span>
          <span className="text-muted text-xs">{formatTime(durationMs)}</span>
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShuffle(!shuffle)} className="p-2" aria-label="Shuffle">
            <Shuffle size={22} className={shuffle ? 'text-primary-soft' : 'text-muted'} />
          </button>
          <button onClick={previousTrack} className="p-2" aria-label="Previous">
            <SkipBack size={30} className="text-text" fill="currentColor" />
          </button>
          <motion.button
            onClick={() => setPlaying(!isPlaying)}
            whileTap={{ scale: 0.94 }}
            className="bg-gradient-to-r from-primary to-primary-soft rounded-3xl flex items-center justify-center shadow-colored"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{ width: 72, height: 72 }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Pause size={32} fill="white" className="text-white" />
                </motion.div>
              ) : (
                <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Play size={32} fill="white" className="text-white ml-1" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
          <button onClick={nextTrack} className="p-2" aria-label="Next">
            <SkipForward size={30} className="text-text" fill="currentColor" />
          </button>
          <button onClick={toggleRepeat} className="p-2" aria-label="Repeat">
            {repeat === 'one' ? <Repeat1 size={22} className="text-primary-soft" /> : <Repeat size={22} className={repeat === 'all' ? 'text-primary-soft' : 'text-muted'} />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <button className="p-2" aria-label="Add to playlist"><ListMusic size={22} className="text-muted" /></button>
          <button className="p-2" aria-label="Download"><Download size={22} className="text-muted" /></button>
          <button className="p-2" aria-label="Share"><Share2 size={22} className="text-muted" /></button>
          <button className="p-2" aria-label="Queue"><ListMusic size={22} className="text-muted" /></button>
        </div>
      </div>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </motion.div>
  );
}
