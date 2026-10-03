import { useState, useEffect } from 'react';
import type { PanInfo } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronUp, EllipsisVertical, Heart, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1, Headphones, Timer, Gauge, ListMusic, Palette,
  FolderPlus, Download, Disc3, Mic2, Info, Check, Type
} from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import type { Song } from '@/store/player';
import { useProgressStore } from '@/store/progress';
import { usePrefsStore } from '@/store/prefs';
import type { PlayerStyle } from '@/store/prefs';
import { useUIStore } from '@/store/ui';
import { playlists, music } from '@/api/endpoints';
import Marquee from '@/components/Marquee';
import EqBars from '@/components/EqBars';
import { Sheet } from '@/components/SheetHost';
import SaveToPlaylistSheet from '@/components/SaveToPlaylistSheet';
import QueueSheet from '@/components/QueueSheet';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { getCachedLyrics, setCachedLyrics, fetchLrclib } from '@/utils/lyrics';

function formatTime(ms: number) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const STYLES_LIST: { id: PlayerStyle; name: string; desc: string }[] = [
  { id: 'cinematic', name: 'Cinematic', desc: 'Full ambient artwork backdrop' },
  { id: 'glass', name: 'Glass', desc: 'Floating art on a frosted panel' },
  { id: 'vinyl', name: 'Vinyl', desc: 'A spinning record with a tonearm' },
  { id: 'classic', name: 'Classic', desc: 'Clean and minimal' },
  { id: 'lyrics', name: 'Lyrics stage', desc: 'Lyrics first, controls tucked below' },
];

const normalizeLyrics = (raw: any) => {
  if (!raw) return null;
  if (Array.isArray(raw.lines) && raw.lines.length) return raw;
  const text =
    typeof raw.lyrics === 'string' ? raw.lyrics :
    typeof raw.lyrics?.lyrics === 'string' ? raw.lyrics.lyrics : '';
  if (!text.trim()) return null;
  const lines = text.replace(/<br\s*\/?>/gi, '\n').split('\n')
    .map((x: string) => x.trim()).filter(Boolean).map((x: string) => ({ t: 0, x }));
  return lines.length ? { type: 'plain', lines } : null;
};

export default function FullPlayer() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const setPlayerLyricsOpen = useUIStore((s) => s.setPlayerLyricsOpen);
  const setPlayerInfoOpen = useUIStore((s) => s.setPlayerInfoOpen);

  const { playerStyle, setPlayerStyle } = usePrefsStore();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const repeat = usePlayerStore((s) => s.repeat);
  const setRepeat = usePlayerStore((s) => s.setRepeat);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const setShuffle = usePlayerStore((s) => s.setShuffle);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const contextTitleStore = usePlayerStore((s) => s.contextTitle);

  const { positionMs, durationMs } = useProgressStore();

  const song: Song | null = queue[currentIndex] || null;
  const effectiveDuration = durationMs > 0 ? durationMs : song?.durationMs || 0;
  const progress = effectiveDuration ? Math.min(1, positionMs / effectiveDuration) : 0;

  // Context Name ("Playing from ...")
  const contextTitle = contextTitleStore || song?.album || 'Your Queue';

  // States
  const [liked, setLiked] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [savePlaylistOpen, setSavePlaylistOpen] = useState(false);

  // Sleep timer & speed
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [timerSheetOpen, setTimerSheetOpen] = useState(false);
  const [speedSheetOpen, setSpeedSheetOpen] = useState(false);

  // Lyrics data
  const [lyricsData, setLyricsData] = useState<any>(null);
  const [lyricsFontSize, setLyricsFontSize] = useState<number>(22);

  // Dragging seek bar
  const [draggingSeek, setDraggingSeek] = useState(false);
  const [seekFraction, setSeekFraction] = useState(0);

  useEffect(() => {
    if (song?.id) {
      playlists.isLiked(song.id).then((l) => setLiked(Boolean(l))).catch(() => {});
    }
  }, [song?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!song?.id) { setLyricsData(null); return; }

    (async () => {
      try {
        const cached = await getCachedLyrics(song.id);
        if (cached && !cancelled) setLyricsData(cached);
      } catch {}

      try {
        const res = await music.lyrics(song.id);
        const norm = normalizeLyrics(res);
        if (norm && !cancelled) { setLyricsData(norm); setCachedLyrics(song.id, norm); return; }
      } catch {}

      try {
        const primaryArtist = (song.artist || '').split(',')[0].trim();
        const lrc = await fetchLrclib(song.name, primaryArtist, song.durationMs || 0);
        if (cancelled) return;
        if (lrc) { setLyricsData(lrc); setCachedLyrics(song.id, lrc); }
        else setLyricsData(null);
      } catch { if (!cancelled) setLyricsData(null); }
    })();

    return () => { cancelled = true; };
  }, [song?.id]);

  useEffect(() => {
    setPlayerLyricsOpen(lyricsOpen);
  }, [lyricsOpen, setPlayerLyricsOpen]);

  useEffect(() => {
    setPlayerInfoOpen(infoOpen);
  }, [infoOpen, setPlayerInfoOpen]);

  if (!song) {
    return (
      <div className="flex flex-col h-full bg-bg items-center justify-center p-5 text-center">
        <p className="t-body text-muted">No song loaded</p>
        <Button size="sm" onClick={() => navigate(-1)} className="mt-4">
          Go back
        </Button>
      </div>
    );
  }

  const handleToggleLike = async () => {
    const next = !liked;
    setLiked(next);
    try {
      await playlists.like(song.id, next);
      addToast(next ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
    } catch (_e) {
      setLiked(!next);
    }
  };

  const handleToggleRepeat = () => {
    if (repeat === 'off') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('off');
  };

  const handleSeekCommit = () => {
    if (effectiveDuration) {
      const targetMs = Math.round(seekFraction * effectiveDuration);
      seekTo(targetMs);
    }
    setDraggingSeek(false);
  };

  const activeStyle = (playerStyle === 'lyrics' && !lyricsData?.lines?.length) ? 'cinematic' : playerStyle;

  // Gestures for Art Zone
  const handleArtDragEnd = (_: any, info: PanInfo) => {
    const dy = info.offset.y;
    const dx = info.offset.x;

    if (Math.abs(dy) > Math.abs(dx) * 1.4) {
      if (dy < -80 || info.velocity.y < -500) {
        setLyricsOpen(true);
      } else if (dy > 100 || info.velocity.y > 600) {
        navigate(-1);
      }
    } else {
      if (dx < -60) nextTrack();
      else if (dx > 60) previousTrack();
    }
  };

  // Gestures for Controls Zone
  const handleControlsDragEnd = (_: any, info: PanInfo) => {
    const dy = info.offset.y;
    if (dy < -60 || info.velocity.y < -500) {
      setInfoOpen(true);
    } else if (dy > 100 || info.velocity.y > 600) {
      navigate(-1);
    }
  };

  return (
    <div className="relative w-full h-full bg-bg overflow-hidden flex flex-col justify-between select-none">
      {/* Background for Cinematic & Glass styles */}
      {(activeStyle === 'cinematic' || activeStyle === 'glass') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {song.image && (
            <img
              src={song.image}
              alt=""
              className="absolute inset-0 w-[150%] h-[150%] -left-[25%] -top-[25%] object-cover blur-3xl opacity-50 transition-all duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-bg" />
        </div>
      )}

      {/* ZONE A: TOP BAR */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-[calc(var(--sat)+8px)] h-[48px]">
        <button
          onClick={() => navigate(-1)}
          className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-white shadow-sm"
          aria-label="Collapse player"
        >
          <ChevronDown size={28} />
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="t-cap text-[12px] text-muted font-medium">Playing from</span>
          <span className="t-h3 text-[14px] font-bold text-text truncate max-w-[200px]">
            {contextTitle}
          </span>
        </div>

        <button
          onClick={() => setOptionsOpen(true)}
          className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-white shadow-sm"
          aria-label="Player options"
        >
          <EllipsisVertical size={22} />
        </button>
      </header>

      {/* ZONE B: ART ZONE */}
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.3}
        onDragEnd={handleArtDragEnd}
        className="relative z-10 flex-1 flex items-center justify-center px-6 py-4 cursor-grab active:cursor-grabbing"
      >
        {/* Style 1: Cinematic */}
        {activeStyle === 'cinematic' && (
          <div className="w-[310px] h-[310px] rounded-[28px] overflow-hidden bg-surface-2 shadow-2xl border border-white/15 relative">
            {song.image ? (
              <motion.img
                layoutId="player-art"
                src={song.image}
                alt={song.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-2 flex items-center justify-center text-muted">🎵</div>
            )}
          </div>
        )}

        {/* Style 2: Glass Card */}
        {activeStyle === 'glass' && (
          <div className="relative w-[280px] h-[280px] rounded-[32px] overflow-hidden shadow-2xl border border-white/20">
            {song.image ? (
              <motion.img
                layoutId="player-art"
                src={song.image}
                alt={song.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-2 flex items-center justify-center text-muted">🎵</div>
            )}
          </div>
        )}

        {/* Style 3: Vinyl */}
        {activeStyle === 'vinyl' && (
          <div className="relative w-[296px] h-[296px] flex items-center justify-center">
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 12, ease: 'linear', repeat: Infinity }}
              className="w-[296px] h-[296px] rounded-full bg-[#0B0B0D] border-[6px] border-[#16161A] shadow-2xl flex items-center justify-center relative overflow-hidden"
            >
              <div className="w-[112px] h-[112px] rounded-full overflow-hidden border-[8px] border-bg relative flex items-center justify-center">
                {song.image && <img src={song.image} alt="" className="w-full h-full object-cover" />}
                <div className="w-2 h-2 rounded-full bg-bg absolute" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Style 4: Classic Minimal */}
        {activeStyle === 'classic' && (
          <div className="w-[320px] h-[320px] rounded-[20px] overflow-hidden bg-surface-2 shadow-2xl">
            {song.image && <img src={song.image} alt={song.name} className="w-full h-full object-cover" />}
          </div>
        )}

        {/* Style 5: Lyrics Stage */}
        {activeStyle === 'lyrics' && (
          <div className="w-full h-full flex flex-col justify-center overflow-y-auto px-4 text-center">
            {Array.isArray(lyricsData?.lines) && lyricsData.lines.length > 0 ? (
              <div className="flex flex-col gap-4 py-8">
                {lyricsData.lines.map((line: any, idx: number) => (
                  <p key={idx} className="t-lyric text-[22px] font-bold text-text/80">
                    {line.x || line.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="t-body text-muted">Lyrics aren't available for this song</p>
            )}
          </div>
        )}
      </motion.div>

      {/* LOWER PANELS (C, D, E, F) */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleControlsDragEnd}
        className="relative z-10 flex flex-col gap-3 px-6 pb-[calc(var(--sab)+12px)]"
      >
        {/* SWIPE UP FOR LYRICS INDICATOR */}
        <button
          onClick={() => setLyricsOpen(true)}
          className="self-center flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-surface-2/80 backdrop-blur-md border border-line/40 text-muted hover:text-text active:scale-95 transition-all cursor-pointer shadow-sm"
        >
          <ChevronUp size={14} className="text-primary animate-bounce" />
          <span className="t-micro text-[11px] font-bold uppercase tracking-wider">Swipe up for lyrics</span>
        </button>

        {/* ZONE C: INFO ROW */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Marquee text={song.name} className="t-h1 text-[26px] font-extrabold text-text truncate" />
              <EqBars isPlaying={isPlaying} />
            </div>
            <button
              onClick={() => song.singers?.[0]?.id && navigate(`/artist/${song.singers[0].id}`)}
              className="t-cap text-[14.5px] text-muted truncate hover:underline text-left block mt-0.5"
            >
              {song.artist}
            </button>
          </div>

          <button
            onClick={handleToggleLike}
            className="w-11 h-11 rounded-full flex items-center justify-center text-text hover:text-heart"
            aria-label="Like"
          >
            <Heart size={26} fill={liked ? '#FF4D6D' : 'none'} className={liked ? 'text-heart' : 'text-text'} />
          </button>
        </div>

        {/* ZONE D: SEEK BAR */}
        <div className="flex flex-col gap-1">
          <div className="relative w-full h-[36px] flex items-center cursor-pointer">
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={draggingSeek ? seekFraction : progress}
              onPointerDown={() => setDraggingSeek(true)}
              onChange={(e) => setSeekFraction(Number(e.target.value))}
              onPointerUp={handleSeekCommit}
              className="w-full h-[4px] bg-line rounded-full outline-none accent-primary appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between t-num text-[12px] text-muted font-medium -mt-2">
            <span>{formatTime(positionMs)}</span>
            <span>{formatTime(effectiveDuration)}</span>
          </div>
        </div>

        {/* ZONE E: CONTROLS ROW */}
        <div className="flex items-center justify-between px-2">
          <button
            onClick={() => setShuffle(!shuffle)}
            className="w-11 h-11 flex items-center justify-center"
            aria-label="Shuffle"
          >
            <Shuffle size={22} className={shuffle ? 'text-primary' : 'text-muted'} />
          </button>

          <button
            onClick={previousTrack}
            className="w-[56px] h-[56px] flex items-center justify-center text-text"
            aria-label="Previous"
          >
            <SkipBack size={30} fill="currentColor" />
          </button>

          <button
            onClick={togglePlay}
            className="w-[72px] h-[72px] rounded-full bg-primary text-on-primary flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </button>

          <button
            onClick={nextTrack}
            className="w-[56px] h-[56px] flex items-center justify-center text-text"
            aria-label="Next"
          >
            <SkipForward size={30} fill="currentColor" />
          </button>

          <button
            onClick={handleToggleRepeat}
            className="w-11 h-11 flex items-center justify-center"
            aria-label="Repeat"
          >
            {repeat === 'one' ? (
              <Repeat1 size={22} className="text-primary" />
            ) : (
              <Repeat size={22} className={repeat === 'all' ? 'text-primary' : 'text-muted'} />
            )}
          </button>
        </div>

        {/* ZONE F: UTILITY ROW */}
        <div className="flex items-center justify-between h-[44px]">
          {/* Output Chip */}
          <div className="h-[38px] px-3.5 rounded-full bg-surface-2 border border-line flex items-center gap-2 max-w-[140px]">
            <Headphones size={18} className="text-muted flex-shrink-0" />
            <span className="t-cap text-[12.5px] font-semibold text-text truncate">
              Phone speaker
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTimerSheetOpen(true)}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                sleepTimerMinutes ? 'bg-primary text-on-primary' : 'text-muted'
              }`}
              aria-label="Timer"
            >
              <Timer size={20} />
            </button>

            <button
              onClick={() => setSpeedSheetOpen(true)}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                playbackSpeed !== 1 ? 'bg-primary text-on-primary' : 'text-muted'
              }`}
              aria-label="Speed"
            >
              <Gauge size={20} />
            </button>

            <button
              onClick={() => setQueueOpen(true)}
              className="w-[44px] h-[44px] rounded-[16px] bg-surface-2 border border-line flex items-center justify-center text-text relative"
              aria-label="Queue"
            >
              <ListMusic size={20} />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-on-primary t-micro text-[11px] font-bold flex items-center justify-center">
                {queue.length}
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* OPTIONS SHEET (§8.9) */}
      <Sheet
        id="player-options-sheet"
        isOpen={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        title="Player options"
      >
        <div className="flex flex-col divide-y divide-line/20 py-2">
          <button
            onClick={() => {
              setOptionsOpen(false);
              setStylePickerOpen(true);
            }}
            className="h-[56px] px-3 flex items-center justify-between hover:bg-surface-2 rounded-[16px] text-left"
          >
            <div className="flex items-center gap-4">
              <Palette size={22} className="text-text" />
              <span className="t-h3 text-[15px] font-semibold text-text">Player style</span>
            </div>
            <span className="t-cap text-[13px] text-muted capitalize">{playerStyle}</span>
          </button>

          <button
            onClick={() => {
              setOptionsOpen(false);
              setSavePlaylistOpen(true);
            }}
            className="h-[56px] px-3 flex items-center gap-4 hover:bg-surface-2 rounded-[16px] text-left"
          >
            <FolderPlus size={22} className="text-text" />
            <span className="t-h3 text-[15px] font-semibold text-text">Add to playlist</span>
          </button>

          <button
            onClick={() => {
              setOptionsOpen(false);
              addToast('Download started', 'info');
            }}
            className="h-[56px] px-3 flex items-center gap-4 hover:bg-surface-2 rounded-[16px] text-left"
          >
            <Download size={22} className="text-text" />
            <span className="t-h3 text-[15px] font-semibold text-text">Download</span>
          </button>

          {song.albumId && (
            <button
              onClick={() => {
                setOptionsOpen(false);
                navigate(`/album/${song.albumId}`);
              }}
              className="h-[56px] px-3 flex items-center gap-4 hover:bg-surface-2 rounded-[16px] text-left"
            >
              <Disc3 size={22} className="text-text" />
              <span className="t-h3 text-[15px] font-semibold text-text">Go to album</span>
            </button>
          )}

          {song.singers?.[0]?.id && (
            <button
              onClick={() => {
                setOptionsOpen(false);
                if (song.singers?.[0]?.id) navigate(`/artist/${song.singers[0].id}`);
              }}
              className="h-[56px] px-3 flex items-center gap-4 hover:bg-surface-2 rounded-[16px] text-left"
            >
              <Mic2 size={22} className="text-text" />
              <span className="t-h3 text-[15px] font-semibold text-text">Go to artist</span>
            </button>
          )}

          <button
            onClick={() => {
              setOptionsOpen(false);
              setInfoOpen(true);
            }}
            className="h-[56px] px-3 flex items-center gap-4 hover:bg-surface-2 rounded-[16px] text-left"
          >
            <Info size={22} className="text-text" />
            <span className="t-h3 text-[15px] font-semibold text-text">Song info</span>
          </button>
        </div>
      </Sheet>

      {/* STYLE PICKER CAROUSEL SHEET (§8.9) */}
      <Sheet
        id="style-picker-sheet"
        isOpen={stylePickerOpen}
        onClose={() => setStylePickerOpen(false)}
        title="Player style"
        maxHeight="70vh"
      >
        <div className="flex flex-col gap-6 py-3">
          <div className="flex gap-4 overflow-x-auto snap-x no-scrollbar px-2 py-2">
            {STYLES_LIST.map((st) => {
              const isSelected = playerStyle === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => setPlayerStyle(st.id)}
                  className={`relative min-w-[168px] h-[260px] rounded-[24px] bg-surface-2 border-2 flex flex-col justify-between p-4 cursor-pointer snap-center shadow-lg transition-all ${
                    isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-line'
                  }`}
                >
                  <div className="w-full h-[120px] rounded-[16px] bg-bg flex items-center justify-center overflow-hidden">
                    {song.image ? (
                      <img src={song.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 size={32} className="text-muted" />
                    )}
                  </div>

                  <div>
                    <h3 className="t-h3 text-[16px] font-bold text-text">{st.name}</h3>
                    <p className="t-cap text-[12px] text-muted leading-tight mt-0.5">{st.desc}</p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button size="lg" onClick={() => setStylePickerOpen(false)} className="w-full">
            Use this style
          </Button>
        </div>
      </Sheet>

      {/* LYRICS PANEL OVERLAY */}
      <AnimatePresence>
        {lyricsOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] bg-bg/95 backdrop-blur-xl flex flex-col p-6 max-w-[480px] mx-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <h2 className="t-h2 text-[20px] font-bold text-text">Lyrics</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLyricsFontSize((s) => (s >= 28 ? 20 : s + 4))}
                  className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                  aria-label="Font size"
                >
                  <Type size={18} />
                </button>
                <button
                  onClick={() => setLyricsOpen(false)}
                  className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                  aria-label="Close lyrics"
                >
                  <ChevronDown size={22} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 text-center">
              {Array.isArray(lyricsData?.lines) && lyricsData.lines.length > 0 ? (
                <div className="flex flex-col gap-5 py-12">
                  {lyricsData.lines.map((line: any, idx: number) => (
                    <p
                      key={idx}
                      style={{ fontSize: `${lyricsFontSize}px` }}
                      className="font-bold text-text/85 leading-relaxed"
                    >
                      {line.x || line.text}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <p className="t-body text-muted">Lyrics aren't available for this song</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SONG INFO SHEET (§8.8) */}
      <Sheet
        id="song-info-sheet"
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Song info"
        maxHeight="62vh"
      >
        <div className="flex flex-col gap-6 py-3">
          <div className="flex items-center gap-4">
            <div className="w-[64px] h-[64px] rounded-[16px] overflow-hidden bg-surface-2 flex-shrink-0">
              {song.image && <img src={song.image} alt={song.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="t-h2 text-[18px] font-bold text-text truncate">{song.name}</h2>
              <p className="t-cap text-[13px] text-muted truncate">{song.artist}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-surface-2 p-4 rounded-[20px] border border-line">
            <div>
              <span className="t-cap text-[12px] text-muted block">Language</span>
              <span className="t-body text-[15px] font-semibold text-text capitalize">
                {song.language || 'Hindi'}
              </span>
            </div>
            <div>
              <span className="t-cap text-[12px] text-muted block">Duration</span>
              <span className="t-body text-[15px] font-semibold text-text">
                {formatTime(effectiveDuration)}
              </span>
            </div>
            <div>
              <span className="t-cap text-[12px] text-muted block">Quality</span>
              <span className="t-body text-[15px] font-semibold text-text">320 kbps</span>
            </div>
            <div>
              <span className="t-cap text-[12px] text-muted block">Album</span>
              <span className="t-body text-[15px] font-semibold text-text truncate block">
                {song.album || 'Single'}
              </span>
            </div>
          </div>
        </div>
      </Sheet>

      {/* SLEEP TIMER SHEET */}
      <Sheet
        id="sleep-timer-sheet"
        isOpen={timerSheetOpen}
        onClose={() => setTimerSheetOpen(false)}
        title="Sleep timer"
      >
        <div className="flex flex-col divide-y divide-line/20 py-2">
          {[5, 10, 15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => {
                setSleepTimerMinutes(mins);
                addToast(`Sleep timer set for ${mins} min`, 'info');
                setTimerSheetOpen(false);
              }}
              className="h-[56px] px-3 flex items-center justify-between hover:bg-surface-2 rounded-[16px] text-left"
            >
              <span className="t-h3 text-[15px] font-semibold text-text">{mins} minutes</span>
              {sleepTimerMinutes === mins && <Check size={18} className="text-primary" />}
            </button>
          ))}
          {sleepTimerMinutes && (
            <button
              onClick={() => {
                setSleepTimerMinutes(null);
                addToast('Sleep timer canceled', 'info');
                setTimerSheetOpen(false);
              }}
              className="h-[56px] px-3 flex items-center text-danger font-semibold t-h3 hover:bg-surface-2 rounded-[16px]"
            >
              Turn off timer
            </button>
          )}
        </div>
      </Sheet>

      {/* SPEED SHEET */}
      <Sheet
        id="speed-sheet"
        isOpen={speedSheetOpen}
        onClose={() => setSpeedSheetOpen(false)}
        title="Playback speed"
      >
        <div className="flex flex-col gap-6 py-3">
          <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((sp) => (
              <Chip
                key={sp}
                label={`${sp}x`}
                selected={playbackSpeed === sp}
                onClick={() => setPlaybackSpeed(sp)}
              />
            ))}
          </div>

          <Button size="lg" onClick={() => setSpeedSheetOpen(false)} className="w-full">
            Done
          </Button>
        </div>
      </Sheet>

      {/* QUEUE & SAVE TO PLAYLIST SHEETS */}
      <QueueSheet isOpen={queueOpen} onClose={() => setQueueOpen(false)} />
      <SaveToPlaylistSheet
        song={song}
        isOpen={savePlaylistOpen}
        onClose={() => setSavePlaylistOpen(false)}
      />
    </div>
  );
}
