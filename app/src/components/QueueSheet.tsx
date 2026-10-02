import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, ArrowUp, ArrowDown, MoreVertical } from 'lucide-react';
import { springs } from '@/motion';
import { usePlayerStore, type Song } from '@/store/player';
import { getSongImage } from '@/utils/image';
import { getArtistsText } from '@/utils/song';
import SongActionSheet from './SongActionSheet';

interface QueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

import { useShallow } from 'zustand/react/shallow';

export default function QueueSheet({ isOpen, onClose }: QueueSheetProps) {
  const { queue, currentIndex, setQueue } = usePlayerStore(
    useShallow((s) => ({
      queue: s.queue,
      currentIndex: s.currentIndex,
      setQueue: s.setQueue,
    }))
  );
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [songSheetOpen, setSongSheetOpen] = useState(false);

  if (!isOpen) return null;

  const handlePlayIndex = (idx: number) => {
    setQueue(queue, idx);
    onClose();
  };

  const handleMoveUp = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (idx <= 0) return;
    const updated = [...queue];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    let newCurrent = currentIndex;
    if (currentIndex === idx) newCurrent = idx - 1;
    else if (currentIndex === idx - 1) newCurrent = idx;
    setQueue(updated, newCurrent);
  };

  const handleMoveDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (idx >= queue.length - 1) return;
    const updated = [...queue];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    let newCurrent = currentIndex;
    if (currentIndex === idx) newCurrent = idx + 1;
    else if (currentIndex === idx + 1) newCurrent = idx;
    setQueue(updated, newCurrent);
  };

  const handleRemove = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (queue.length <= 1) return;
    const updated = queue.filter((_, i) => i !== idx);
    let newCurrent = currentIndex;
    if (idx < currentIndex) newCurrent = Math.max(0, currentIndex - 1);
    else if (idx === currentIndex) newCurrent = Math.min(idx, updated.length - 1);
    setQueue(updated, newCurrent);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="bg-surface/95 backdrop-blur-2xl border-t border-border/80 rounded-t-3xl pb-safe flex flex-col max-h-[80vh] h-[80vh] relative z-10 shadow-2xl overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={springs.sheet}
        >
          <div className="p-5 flex flex-col h-full">
            <div className="w-12 h-1.5 bg-border rounded-full opacity-50 mx-auto mb-3" />
            <h3 className="text-text font-bold text-xl mb-4">Playing Queue ({queue.length})</h3>

            <div className="flex-1 overflow-y-auto scroll-y pr-1 flex flex-col gap-2">
              {queue.map((song, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <div
                    key={`${song.id}-${idx}`}
                    onClick={() => handlePlayIndex(idx)}
                    className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-colors ${
                      isCurrent ? 'bg-primary/20 border border-primary/40' : 'bg-surface-2/40 hover:bg-surface-2'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface flex-shrink-0 relative">
                      {getSongImage(song) ? (
                        <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />
                      ) : null}
                      {isCurrent && (
                        <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                          <Play size={16} fill="white" className="text-white ml-0.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm font-bold line-clamp-1 ${isCurrent ? 'text-primary-soft' : 'text-text'}`}>
                        {song.name}
                      </p>
                      <p className="text-muted text-xs line-clamp-1">{getArtistsText(song)}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleMoveUp(e, idx)}
                        disabled={idx === 0}
                        className="p-1.5 text-muted hover:text-text disabled:opacity-30"
                        aria-label="Move Up"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={(e) => handleMoveDown(e, idx)}
                        disabled={idx === queue.length - 1}
                        className="p-1.5 text-muted hover:text-text disabled:opacity-30"
                        aria-label="Move Down"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSong(song);
                          setSongSheetOpen(true);
                        }}
                        className="p-1.5 text-muted hover:text-text"
                        aria-label="Options"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {queue.length > 1 && (
                        <button
                          onClick={(e) => handleRemove(e, idx)}
                          className="p-1.5 text-muted hover:text-danger"
                          aria-label="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {selectedSong && (
          <SongActionSheet
            song={selectedSong}
            isOpen={songSheetOpen}
            onClose={() => {
              setSongSheetOpen(false);
              setSelectedSong(null);
            }}
          />
        )}
      </div>
    </AnimatePresence>
  );
}
