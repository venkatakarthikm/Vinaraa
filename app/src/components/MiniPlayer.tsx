import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@/store/player';
import { useProgressStore } from '@/store/progress';
import { useUIStore } from '@/store/ui';
import { Play, Pause, SkipForward, Disc3 } from 'lucide-react';
import { springs } from '@/motion';
import Marquee from './Marquee';
import { useShallow } from 'zustand/react/shallow';

export default function MiniPlayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const sheets = useUIStore((s) => s.sheets);

  const { queue, currentIndex, isPlaying, togglePlay, nextTrack } = usePlayerStore(
    useShallow((s) => ({
      queue: s.queue,
      currentIndex: s.currentIndex,
      isPlaying: s.isPlaying,
      togglePlay: s.togglePlay,
      nextTrack: s.nextTrack,
    }))
  );

  const { positionMs, durationMs, epoch } = useProgressStore(
    useShallow((s) => ({
      positionMs: s.positionMs,
      durationMs: s.durationMs,
      epoch: s.epoch,
    }))
  );

  const song = queue[currentIndex];
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  // Hide mini player when a bottom sheet is open or no song
  if (!song || sheets.length > 0) return null;

  const path = location.pathname;
  // Compact CD mode on detail pages & search screen so it never covers inputs / filters
  const isCompactMode =
    path === '/search' ||
    path.startsWith('/album/') ||
    path.startsWith('/artist/') ||
    path.startsWith('/playlist/') ||
    path.startsWith('/profile') ||
    path.startsWith('/settings') ||
    path.startsWith('/downloads');

  return (
    <AnimatePresence mode="wait">
      {isCompactMode ? (
        /* Draggable Rotating CD / Vinyl Mini Player Badge */
        <motion.div
          key="compact-cd"
          drag
          dragConstraints={{ left: -320, right: 10, top: -650, bottom: 10 }}
          dragElastic={0.2}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={springs.snappy}
          onClick={() => navigate('/player')}
          className="fixed right-4 z-40 w-[58px] h-[58px] cursor-grab active:cursor-grabbing select-none"
          style={{ bottom: 'calc(var(--sab) + 64px + 12px)' }}
        >
          <div className="relative w-full h-full rounded-full bg-[#0B0B0D] border-[2px] border-line shadow-2xl flex items-center justify-center overflow-hidden">
            {/* Rotating Vinyl/Cover */}
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
              className="w-full h-full rounded-full overflow-hidden flex items-center justify-center p-1 pointer-events-none"
            >
              {song.image ? (
                <img
                  src={song.image}
                  alt={song.name}
                  className="w-full h-full object-cover rounded-full pointer-events-none"
                />
              ) : (
                <Disc3 size={32} className="text-muted" />
              )}
            </motion.div>

            {/* Center Spindle & Play/Pause Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="pointer-events-auto w-6 h-6 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-md active:scale-90 transition-transform"
              >
                {isPlaying ? <Pause size={12} fill="white" /> : <Play size={12} fill="white" className="ml-0.5" />}
              </button>
            </div>

            {/* Circular Progress SVG Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
              <circle
                cx="29"
                cy="29"
                r="27"
                fill="none"
                stroke="var(--c-line)"
                strokeWidth="2"
              />
              <circle
                cx="29"
                cy="29"
                r="27"
                fill="none"
                stroke="var(--c-primary)"
                strokeWidth="2.5"
                strokeDasharray={170}
                strokeDashoffset={170 * (1 - progress)}
                strokeLinecap="round"
                className="transition-all duration-200"
              />
            </svg>
          </div>
        </motion.div>
      ) : (
        /* Full Horizontal Mini Player Bar */
        <motion.div
          key="full-bar"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={springs.sheet}
          onClick={() => navigate('/player')}
          className="fixed left-[12px] right-[12px] z-30 h-[56px] rounded-[20px] bg-surface/92 backdrop-blur-md border border-line shadow-lg overflow-hidden cursor-pointer"
          style={{ bottom: 'calc(var(--sab) + 64px + 8px)' }}
        >
          <div className="flex items-center h-full px-2 justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-[12px] overflow-hidden bg-surface-2 flex-shrink-0">
                {song.image ? (
                  <motion.img
                    layoutId="player-art"
                    src={song.image}
                    alt={song.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">🎵</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Marquee text={song.name} className="t-h3 text-text text-sm font-semibold truncate" />
                <p className="t-cap text-muted text-xs truncate">{song.artist}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center active:scale-95"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextTrack();
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-text"
                aria-label="Next track"
              >
                <SkipForward size={22} />
              </button>
            </div>
          </div>

          <div className="absolute top-0 left-0 right-0 h-[2px] bg-line overflow-hidden">
            <div
              key={epoch}
              className="h-full bg-primary origin-left"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
