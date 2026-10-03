import { useState, useRef } from 'react';
import type { PanInfo } from 'framer-motion';
import { motion } from 'framer-motion';
import { EllipsisVertical, CircleCheck, ListEnd, ListPlus, Music2 } from 'lucide-react';
import type { Song } from '@/store/player';
import { usePlayerStore } from '@/store/player';
import EqBars from './EqBars';
import { useUIStore } from '@/store/ui';

interface SongRowProps {
  song: Song;
  index?: number;
  showIndex?: boolean;
  onMoreClick?: (song: Song) => void;
  onPlay?: () => void;
  onRemoveFromPlaylist?: () => void;
  isDownloaded?: boolean;
  isExplicit?: boolean;
}

function formatDuration(ms?: number) {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

export default function SongRow({
  song,
  index,
  showIndex = false,
  onMoreClick,
  onPlay,
  isDownloaded = false,
  isExplicit = false,
}: SongRowProps) {
  const currentSong = usePlayerStore((s) => s.currentSong());
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playNext = usePlayerStore((s) => s.playNext);
  const appendToQueue = usePlayerStore((s) => s.appendToQueue);
  const addToast = useUIStore((s) => s.addToast);

  const isCurrent = currentSong?.id === song.id;
  const [dragX, setDragX] = useState(0);
  const [imgError, setImgError] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      if (onMoreClick) onMoreClick(song);
    }, 350);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    const offset = info.offset.x;
    if (offset > 72 || info.velocity.x > 500) {
      playNext(song);
      addToast('Playing next', 'info');
    } else if (offset < -72 || info.velocity.x < -500) {
      appendToQueue([song]);
      addToast('Added to queue', 'info');
    }
    setDragX(0);
  };

  return (
    <div className="relative overflow-hidden w-full h-[64px] bg-surface select-none">
      {/* Background Swipe Actions (Only rendered when user actively drags) */}
      {dragX !== 0 && (
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
          <div className="w-1/2 h-full bg-primary flex items-center justify-start pl-6 gap-2 text-on-primary">
            <ListEnd size={20} />
            <span className="t-cap font-semibold">Play next</span>
          </div>
          <div className="w-1/2 h-full bg-surface-3 flex items-center justify-end pr-6 gap-2 text-text">
            <span className="t-cap font-semibold">Add to queue</span>
            <ListPlus size={20} />
          </div>
        </div>
      )}

      {/* Foreground Song Row (Solid Background) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDrag={(_, info) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        animate={{ x: dragX }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={onPlay}
        className={`relative z-10 w-full h-[64px] px-4 flex items-center justify-between transition-colors duration-120 cursor-pointer ${
          isCurrent ? 'bg-surface-2 border-l-4 border-primary' : 'bg-surface hover:bg-surface-2 active:bg-surface-2'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Index or Artwork */}
          {showIndex ? (
            <div className="w-[28px] flex items-center justify-center flex-shrink-0">
              {isCurrent ? (
                <EqBars isPlaying={isPlaying} />
              ) : (
                <span className="t-num text-[14px] font-semibold text-muted">
                  {(index ?? 0) + 1}
                </span>
              )}
            </div>
          ) : (
            <div className="relative w-[48px] h-[48px] rounded-[12px] overflow-hidden bg-surface-2 flex-shrink-0">
              {song.image && !imgError ? (
                <img
                  src={song.image}
                  alt={song.name}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  <Music2 size={20} />
                </div>
              )}

              {isCurrent && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                  <EqBars isPlaying={isPlaying} color="white" />
                </div>
              )}
            </div>
          )}

          {/* Title & Artist */}
          <div className="flex-1 min-w-0">
            <h3
              lang={song.language}
              className={`t-h3 text-[15px] font-bold truncate ${
                isCurrent ? 'text-primary' : 'text-text'
              }`}
            >
              {song.name}
            </h3>

            <div className="flex items-center gap-1.5 min-w-0 text-muted mt-0.5">
              {isDownloaded && <CircleCheck size={14} className="text-primary flex-shrink-0" />}
              {isExplicit && (
                <span className="w-3.5 h-3.5 rounded-[3px] border border-muted text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  E
                </span>
              )}
              <span className="t-cap text-[12px] truncate">{song.artist}</span>
            </div>
          </div>
        </div>

        {/* Duration & More Menu */}
        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
          {song.durationMs ? (
            <span className="t-num text-[12px] text-muted font-medium">
              {formatDuration(song.durationMs)}
            </span>
          ) : null}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onMoreClick) onMoreClick(song);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-text active:scale-95 transition-transform"
            aria-label="More options"
          >
            <EllipsisVertical size={20} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
