import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/player';
import { useProgressStore } from '@/store/progress';
import { Play, Pause, SkipForward } from 'lucide-react';
import { springs } from '@/motion';
import Marquee from './Marquee';

import { useShallow } from 'zustand/react/shallow';

export default function MiniPlayer() {
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
  const navigate = useNavigate();
  const song = queue[currentIndex];
  const progress = durationMs > 0 ? (positionMs / durationMs) : 0;

  if (!song) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={springs.sheet}
        className="fixed left-[12px] right-[12px] z-30 h-[56px] rounded-[20px] bg-surface/90 backdrop-blur-md border border-line shadow-lg overflow-hidden cursor-pointer"
        style={{ bottom: `calc(var(--sab) + 8px + 64px + 8px)` }}
        onClick={() => navigate('/player')}
      >
        <div className="flex items-center h-full px-2 justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-[12px] overflow-hidden bg-surface-2 flex-shrink-0">
              {song.image && (
                <motion.img
                  layoutId="player-art"
                  src={song.image}
                  alt={song.name}
                  className="w-full h-full object-cover"
                />
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
              className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextTrack();
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted"
              aria-label="Next track"
            >
              <SkipForward size={22} />
            </button>
          </div>
        </div>

        {/* Top 2px progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-line overflow-hidden">
          <div
            key={epoch}
            className="h-full bg-primary origin-left"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
