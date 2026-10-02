import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListEnd, ListPlus, Heart, FolderPlus, Download, Disc3, Mic2, Share2, Info, Trash2 } from 'lucide-react';
import { Sheet } from './SheetHost';
import type { Song } from '@/store/player';
import { usePlayerStore } from '@/store/player';
import { playlists } from '@/api/endpoints';
import { useUIStore } from '@/store/ui';

interface SongActionSheetProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  playlistId?: string;
  onOpenSaveToPlaylist?: (song: Song) => void;
  onOpenSongInfo?: (song: Song) => void;
}

export default function SongActionSheet({
  song,
  isOpen,
  onClose,
  playlistId,
  onOpenSaveToPlaylist,
  onOpenSongInfo,
}: SongActionSheetProps) {
  const navigate = useNavigate();
  const playNext = usePlayerStore((s) => s.playNext);
  const appendToQueue = usePlayerStore((s) => s.appendToQueue);
  const addToast = useUIStore((s) => s.addToast);

  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (song?.id) {
      playlists.isLiked(song.id).then((liked) => setIsLiked(Boolean(liked))).catch(() => {});
    }
  }, [song]);

  if (!song) return null;

  const handleToggleLike = async () => {
    const next = !isLiked;
    setIsLiked(next);
    try {
      await playlists.like(song.id, next);
      addToast(next ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
    } catch (_e) {
      setIsLiked(!next);
      addToast('Failed to update liked state', 'error');
    }
    onClose();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: song.name,
        text: `${song.name} — ${song.artist} on Vinaraa`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      addToast('Copied link', 'info');
    }
    onClose();
  };

  const rows = [
    {
      icon: ListEnd,
      label: 'Play next',
      action: () => {
        playNext(song);
        addToast('Playing next', 'info');
        onClose();
      },
    },
    {
      icon: ListPlus,
      label: 'Add to queue',
      action: () => {
        appendToQueue([song]);
        addToast('Added to queue', 'info');
        onClose();
      },
    },
    {
      icon: Heart,
      label: isLiked ? 'Unlike' : 'Like',
      color: isLiked ? 'text-heart' : 'text-text',
      action: handleToggleLike,
    },
    {
      icon: FolderPlus,
      label: 'Add to playlist',
      action: () => {
        onClose();
        if (onOpenSaveToPlaylist) onOpenSaveToPlaylist(song);
      },
    },
    {
      icon: Download,
      label: 'Download',
      action: () => {
        addToast('Download started', 'info');
        onClose();
      },
    },
    {
      icon: Disc3,
      label: 'Go to album',
      action: () => {
        onClose();
        if (song.albumId) navigate(`/album/${song.albumId}`);
      },
    },
    {
      icon: Mic2,
      label: 'Go to artist',
      action: () => {
        onClose();
        if (song.singers?.[0]?.id) navigate(`/artist/${song.singers[0].id}`);
      },
    },
    {
      icon: Share2,
      label: 'Share',
      action: handleShare,
    },
    {
      icon: Info,
      label: 'Song info',
      action: () => {
        onClose();
        if (onOpenSongInfo) onOpenSongInfo(song);
      },
    },
  ];

  if (playlistId) {
    rows.push({
      icon: Trash2,
      label: 'Remove from this playlist',
      color: 'text-danger',
      action: async () => {
        try {
          await playlists.removeTrack(playlistId, { songIds: [song.id] });
          addToast('Removed from playlist', 'info');
        } catch (_e) {
          addToast('Failed to remove song', 'error');
        }
        onClose();
      },
    });
  }

  return (
    <Sheet id="song-action-sheet" isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-2 border-b border-line/40">
          <div className="w-[56px] h-[56px] rounded-[14px] overflow-hidden bg-surface-2 flex-shrink-0">
            {song.image ? (
              <img src={song.image} alt={song.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">🎵</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="t-h3 text-[16px] font-bold text-text truncate">{song.name}</h3>
            <p className="t-cap text-[12.5px] text-muted truncate">{song.artist}</p>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-line/20">
          {rows.map((row, idx) => {
            const Icon = row.icon;
            return (
              <button
                key={idx}
                onClick={row.action}
                className="h-[56px] px-3 flex items-center gap-4 hover:bg-surface-2 rounded-[16px] text-left transition-colors"
              >
                <Icon size={22} className={row.color || 'text-text'} />
                <span className={`t-h3 text-[15px] font-semibold ${row.color || 'text-text'}`}>
                  {row.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
