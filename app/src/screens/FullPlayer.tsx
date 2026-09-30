import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/player';
import { tracking } from '@/api/endpoints';
import {
  ChevronDown, Heart, MoreHorizontal, SkipBack, SkipForward,
  Play, Pause, Shuffle, Repeat, Repeat1, Share2, Download, Plus
} from 'lucide-react';
import { springs } from '@/motion';
import { playlists } from '@/api/endpoints';
import { VinaraaPlayer } from '@/native/player';

type PlayerTab = 'photo' | 'lyrics' | 'info';

function formatTime(ms: number) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function FullPlayer() {
  const {
    isPlaying, positionMs, durationMs,
    repeat, shuffle, togglePlay, seekTo, nextTrack, previousTrack,
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
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  positionRef.current = positionMs;
  const song = currentSong();

  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!song?.id) return;
    let currentSessionId = '';
    tracking.startSession(song.id).then((s) => {
      currentSessionId = s.sessionId;
      sessionIdRef.current = s.sessionId;
      setSessionId(s.sessionId);
    }).catch(() => {});
    playlists.isLiked(song.id).then((res) => setLiked(res.liked)).catch(() => {});
    return () => {
      const sid = currentSessionId || sessionIdRef.current;
      if (sid) tracking.endSession(sid, Math.round(positionRef.current)).catch(() => {});
    };
  }, [song?.id]);

  useEffect(() => {
    if (!sessionId) return;
    heartbeatRef.current = setInterval(() => {
      tracking.heartbeat(sessionId, { positionMs: Math.round(positionRef.current), state: isPlaying ? 'playing' : 'paused' }).catch(() => {});
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
    if (playerTab === 'lyrics' && lyrics?.type === 'synced' && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.querySelector('#active-lyric');
      if (activeEl) {
        const container = lyricsContainerRef.current;
        const scrollTarget = (activeEl as HTMLElement).offsetTop - container.clientHeight / 2 + (activeEl as HTMLElement).clientHeight / 2;
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      }
    }
  }, [positionMs, playerTab, lyrics]);

  const progress = durationMs ? (seeking ? seekValue : positionMs / durationMs) : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeeking(true);
    setSeekValue(Number(e.target.value));
  };

  const handleSeekCommit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPos = Number(e.target.value) * (durationMs || 0);
    seekTo(newPos);
    setSeeking(false);
  };

  const toggleRepeat = () => {
    if (repeat === 'off') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('off');
  };

  const handleLike = () => {
    if (!song?.id) return;
    const newLiked = !liked;
    setLiked(newLiked);
    playlists.like(song.id, newLiked).catch(() => setLiked(!newLiked));
  };

  const TABS: PlayerTab[] = ['photo', 'lyrics', 'info'];
  const handleSwipeTabs = (_: any, info: any) => {
    const idx = TABS.indexOf(playerTab);
    if (info.offset.x < -40 && idx < TABS.length - 1) setPlayerTab(TABS[idx + 1]);
    if (info.offset.x > 40 && idx > 0) setPlayerTab(TABS[idx - 1]);
  };

  const handleShare = async () => {
    if (!song) return;
    try {
      if (navigator.share) await navigator.share({ title: `Listen to ${song.name}`, url: window.location.href });
    } catch (e) { console.error(e); }
  };

  const handleDownload = async () => {
    if (!song?.streamUrl) return;
    try {
      await VinaraaPlayer.download({ url: song.streamUrl, title: song.name, fileName: `${song.name}.mp3` });
    } catch (e) { console.error(e); }
  };

  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [suggestedName, setSuggestedName] = useState('');

  const handleSaveToPlaylistClick = async () => {
    if (!song) return;
    setShowSaveSheet(true);
    try {
      const [plRes, nameRes] = await Promise.all([
        playlists.list(),
        playlists.nameSuggestion()
      ]);
      setUserPlaylists(Array.isArray(plRes) ? plRes.filter((p: any) => !p.isSystem) : (plRes?.items || []).filter((p: any) => !p.isSystem));
      setSuggestedName(nameRes?.suggestedName || 'New Playlist');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToPlaylist = async (playlistId?: string) => {
    if (!song) return;
    try {
      if (playlistId) {
        await playlists.saveSong({ songId: song.id, playlistId });
      } else {
        await playlists.saveSong({ songId: song.id, newPlaylistName: suggestedName });
      }
      setShowSaveSheet(false);
    } catch (e) {
      console.error(e);
    }
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
      className="flex flex-col h-full bg-bg overflow-hidden relative"
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={springs.sheet}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.4}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={(_, info) => { if (info.offset.y > 100) { setShowPlayer(false); navigate(-1); } }}
    >
      <div 
        className="flex items-center justify-between px-5 pt-4 pb-2"
        style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)` }}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <button onClick={() => { setShowPlayer(false); navigate(-1); }} className="p-2 -ml-2" aria-label="Close player">
          <ChevronDown size={28} className="text-text" />
        </button>
        <div className="w-12 h-1.5 bg-border rounded-full opacity-50 absolute left-1/2 -translate-x-1/2 top-4" />
        <p className="text-muted text-[10px] uppercase tracking-widest font-bold">Now Playing</p>
        <button className="p-2 -mr-2" aria-label="More options">
          <MoreHorizontal size={26} className="text-text" />
        </button>
      </div>

      <div className="flex mx-5 bg-surface-2 rounded-full p-1 mb-4 mt-2">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setPlayerTab(tab)}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${playerTab === tab ? 'bg-primary text-white shadow-colored' : 'text-muted'}`}>
            {tab}
          </button>
        ))}
      </div>

      <motion.div 
        className="flex-1 px-5 min-h-0 w-full"
        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
        onDragEnd={handleSwipeTabs}
      >
        <AnimatePresence mode="wait">
          {playerTab === 'photo' && (
            <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full touch-none"
              onPointerDown={(e) => dragControls.start(e)}>
              <motion.div
                className="w-full aspect-square max-w-[320px] rounded-[32px] overflow-hidden shadow-[0_20px_50px_-12px_rgba(139,61,255,0.4)]"
                animate={isPlaying ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
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
              ref={lyricsContainerRef}
              className="h-full overflow-y-auto scroll-y text-center py-4 px-2 select-none relative"
              onPointerDown={(e) => e.stopPropagation()}>
              {!lyrics ? <p className="text-muted pt-20">Loading lyrics…</p>
                : lyrics.type === 'synced' ? (
                  <div className="flex flex-col gap-4 pb-[50vh] pt-[25vh]">
                    {lyrics.lines.map((l: any, i: number) => {
                      const isActive = (positionMs / 1000) >= l.t && (i === lyrics.lines.length - 1 || (positionMs / 1000) < lyrics.lines[i + 1].t);
                      return (
                        <p key={i} id={isActive ? 'active-lyric' : undefined} 
                          className={`text-2xl font-bold transition-all duration-500 ease-out ${isActive ? 'text-primary-soft scale-110 drop-shadow-[0_0_12px_rgba(139,61,255,0.8)]' : 'text-text/30'}`}>
                          {l.x}
                        </p>
                      );
                    })}
                  </div>
                ) : lyrics.lyrics ? (
                  <pre className="text-text/80 font-sans text-lg leading-10 whitespace-pre-wrap pb-[30vh] pt-4">{lyrics.lyrics}</pre>
                ) : <p className="text-muted pt-20">Lyrics not available</p>}
            </motion.div>
          )}
          {playerTab === 'info' && (
            <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto scroll-y py-4 flex flex-col gap-6 px-2 pb-32"
              onPointerDown={(e) => e.stopPropagation()}>
              {song.album && (
                <div>
                  <p className="text-muted text-xs uppercase tracking-wider mb-1">Album / Movie</p>
                  <p className="text-text font-semibold text-lg">{song.album}</p>
                </div>
              )}
              {song.singers && song.singers.length > 0 && (
                <div>
                  <p className="text-muted text-xs uppercase tracking-wider mb-1">Singer(s)</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {song.singers.map((a: any) => (
                      <span key={a.id} className="bg-surface-2 border border-border text-text px-4 py-1.5 rounded-full text-sm font-medium">{a.name}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-8">
                {song.language && (
                  <div>
                    <p className="text-muted text-xs uppercase tracking-wider mb-1">Language</p>
                    <p className="text-text font-semibold capitalize">{song.language}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted text-xs uppercase tracking-wider mb-1">Duration</p>
                  <p className="text-text font-semibold">{formatTime(durationMs)}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="px-6 py-2 flex items-center justify-between bg-gradient-to-t from-bg via-bg to-transparent">
        <div className="min-w-0 pr-4">
          <h2 className="text-text text-2xl font-bold leading-tight line-clamp-1">{song.name}</h2>
          <p className="text-muted text-sm font-medium line-clamp-1 mt-1">{song.artist}</p>
        </div>
        <motion.button
          onClick={handleLike}
          whileTap={{ scale: 1.35 }}
          transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
          className="p-3 bg-surface-2 rounded-full border border-border flex-shrink-0"
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={24} fill={liked ? '#FF3D8E' : 'none'} className={liked ? 'text-[#FF3D8E]' : 'text-text'} />
        </motion.button>
      </div>

      <div className="px-6 mb-2 mt-2">
        <input
          type="range" min={0} max={1} step={0.001}
          value={seeking ? seekValue : progress}
          onChange={handleSeekChange}
          onMouseUp={handleSeekCommit as any}
          onTouchEnd={handleSeekCommit as any}
          className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer bg-surface-2"
          style={{ backgroundImage: `linear-gradient(to right, #8B3DFF ${progress * 100}%, transparent ${progress * 100}%)` }}
          aria-label="Seek"
        />
        <div className="flex justify-between mt-2">
          <span className="text-muted text-xs font-medium tracking-wide">{formatTime(positionMs)}</span>
          <span className="text-muted text-xs font-medium tracking-wide">{formatTime(durationMs)}</span>
        </div>
      </div>

      <div className="px-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setShuffle(!shuffle)} className="p-2" aria-label="Shuffle">
            <Shuffle size={24} className={shuffle ? 'text-primary-soft' : 'text-muted'} />
          </button>
          <button onClick={previousTrack} className="p-2" aria-label="Previous">
            <SkipBack size={36} className="text-text" fill="currentColor" />
          </button>
          <motion.button
            onClick={() => togglePlay()}
            whileTap={{ scale: 0.92 }}
            className="bg-primary rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(139,61,255,0.5)]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{ width: 80, height: 80 }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Pause size={38} fill="white" className="text-white" />
                </motion.div>
              ) : (
                <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Play size={38} fill="white" className="text-white ml-2" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
          <button onClick={nextTrack} className="p-2" aria-label="Next">
            <SkipForward size={36} className="text-text" fill="currentColor" />
          </button>
          <button onClick={toggleRepeat} className="p-2" aria-label="Repeat">
            {repeat === 'one' ? <Repeat1 size={24} className="text-primary-soft" /> : <Repeat size={24} className={repeat === 'all' ? 'text-primary-soft' : 'text-muted'} />}
          </button>
        </div>
        <div className="flex items-center justify-center gap-8 mt-4 pb-2">
          <button onClick={handleSaveToPlaylistClick} className="p-3 bg-surface-2 rounded-full border border-border" aria-label="Add to playlist"><Plus size={20} className="text-text" /></button>
          <button onClick={handleDownload} className="p-3 bg-surface-2 rounded-full border border-border" aria-label="Download"><Download size={20} className="text-text" /></button>
          <button onClick={handleShare} className="p-3 bg-surface-2 rounded-full border border-border" aria-label="Share"><Share2 size={20} className="text-text" /></button>
        </div>
      </div>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />

      <AnimatePresence>
        {showSaveSheet && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col justify-end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowSaveSheet(false)} />
            <motion.div
              className="bg-surface rounded-t-3xl pb-safe flex flex-col max-h-[70vh]"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={springs.sheet}
            >
              <div className="p-5 flex flex-col h-full">
                <div className="w-12 h-1.5 bg-border rounded-full opacity-50 mx-auto mb-4" />
                <h3 className="text-text font-bold text-xl mb-4">Save to Playlist</h3>
                <div className="flex-1 overflow-y-auto scroll-y pr-2">
                  <button onClick={() => handleAddToPlaylist()} className="flex items-center gap-4 py-3 w-full border-b border-border mb-2">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Plus size={24} className="text-primary-soft" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-text font-bold">New Playlist</p>
                      <p className="text-muted text-xs">{suggestedName}</p>
                    </div>
                  </button>
                  {userPlaylists.map((pl) => (
                    <button key={pl.id || pl._id} onClick={() => handleAddToPlaylist(pl.id || pl._id)} className="flex items-center gap-4 py-3 w-full">
                      <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {pl.coverImageUrl || pl.artwork ? <img src={pl.coverImageUrl || pl.artwork} alt={pl.name} className="w-full h-full object-cover" /> : <span className="text-muted text-xl">🎵</span>}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-text font-bold">{pl.name}</p>
                        <p className="text-muted text-xs">{pl.trackCount || 0} songs</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
