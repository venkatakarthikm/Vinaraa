import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/player';
import { Play, Pause, SkipForward } from 'lucide-react';
import { springs } from '@/motion';

export default function MiniPlayer() {
  const { queue, currentIndex, isPlaying, setPlaying, nextTrack, setShowPlayer, showPlayer } = usePlayerStore();
  const navigate = useNavigate();
  const song = queue[currentIndex];

  if (!song || showPlayer) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={springs.sheet}
        className="fixed left-3 right-3 z-40"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + 72px)` }}
      >
        <button
          onClick={() => { setShowPlayer(true); navigate('/player'); }}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 shadow-colored"
        >
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
            {song.image && <img src={song.image} alt={song.name} className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-text text-sm font-semibold line-clamp-1">{song.name}</p>
            <p className="text-muted text-xs line-clamp-1">{song.artist}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setPlaying(!isPlaying); }}
              className="p-2 rounded-full bg-primary"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} fill="white" className="text-white" /> : <Play size={18} fill="white" className="text-white" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextTrack(); }}
              className="p-2 text-muted"
              aria-label="Next track"
            >
              <SkipForward size={20} />
            </button>
          </div>
        </button>
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: '30%' }} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
