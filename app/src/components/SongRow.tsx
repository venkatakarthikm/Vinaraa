import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { getSongImage } from '@/utils/image';
import { getArtistsText } from '@/utils/song';
import SongActionSheet from './SongActionSheet';

function formatDuration(ms?: number) {
  if (!ms || isNaN(ms)) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface SongRowProps {
  song: any;
  onPlay: () => void;
  onRemoveFromPlaylist?: () => void;
}

export default function SongRow({ song, onPlay, onRemoveFromPlaylist }: SongRowProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const durationStr = formatDuration(song.durationMs || (song.duration ? song.duration * 1000 : 0));

  return (
    <>
      <div className="flex items-center gap-3 py-2.5 px-1 hover:bg-surface-2/40 rounded-2xl transition-colors group">
        <button onClick={onPlay} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2 shadow-sm">
            {getSongImage(song) && (
              <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text text-sm font-semibold line-clamp-1">{song.name || song.title}</p>
            <p className="text-muted text-xs line-clamp-1 mt-0.5">{getArtistsText(song)}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {durationStr && <span className="text-muted text-xs font-medium">{durationStr}</span>}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSheetOpen(true);
            }}
            className="p-2 text-muted hover:text-text rounded-full transition-colors"
            aria-label="More options"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <SongActionSheet
        song={song}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onRemoveFromPlaylist={onRemoveFromPlaylist}
      />
    </>
  );
}
