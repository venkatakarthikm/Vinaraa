import { useState } from 'react';
import { Sparkles, GripVertical } from 'lucide-react';
import { Sheet } from './SheetHost';
import { usePlayerStore } from '@/store/player';
import SongRow from './SongRow';
import { useUIStore } from '@/store/ui';

interface QueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QueueSheet({ isOpen, onClose }: QueueSheetProps) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToast = useUIStore((s) => s.addToast);

  const [autoplay, setAutoplay] = useState(true);

  const currentSong = queue[currentIndex];
  const nextUp = queue.slice(currentIndex + 1);
  const played = queue.slice(0, currentIndex);

  const handleClear = () => {
    if (currentSong) {
      setQueue([currentSong], 0);
      addToast('Queue cleared', 'info');
    }
  };

  return (
    <Sheet id="queue-sheet" isOpen={isOpen} onClose={onClose} title="Queue" maxHeight="88vh">
      <div className="flex flex-col gap-6 py-2">
        <div className="flex items-center justify-between">
          <span className="t-cap text-[13px] text-muted font-medium">
            {queue.length} songs
          </span>
          <button
            onClick={handleClear}
            className="t-cap text-[13px] font-semibold text-danger hover:underline"
          >
            Clear queue
          </button>
        </div>

        {currentSong && (
          <section className="flex flex-col gap-2">
            <h3 className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
              Now playing
            </h3>
            <SongRow song={currentSong} showIndex={false} />
          </section>
        )}

        {nextUp.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
              Next up
            </h3>
            <div className="flex flex-col divide-y divide-line/20">
              {nextUp.map((song, idx) => (
                <div key={song.id || idx} className="flex items-center justify-between">
                  <div className="flex-1">
                    <SongRow
                      song={song}
                      onPlay={() => {
                        setQueue(queue, currentIndex + 1 + idx);
                      }}
                    />
                  </div>
                  <button className="p-3 text-muted" aria-label="Reorder">
                    <GripVertical size={20} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {played.length > 0 && (
          <section className="flex flex-col gap-2 opacity-60">
            <h3 className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
              Played ({played.length})
            </h3>
            <div className="flex flex-col divide-y divide-line/20">
              {played.map((song, idx) => (
                <SongRow
                  key={song.id || idx}
                  song={song}
                  onPlay={() => setQueue(queue, idx)}
                />
              ))}
            </div>
          </section>
        )}

        <div className="sticky bottom-0 bg-surface surface-glass pt-4 pb-2 border-t border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <span className="t-body text-[15px] font-semibold text-text">
              Autoplay similar songs
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-[52px] h-[32px] bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
      </div>
    </Sheet>
  );
}
