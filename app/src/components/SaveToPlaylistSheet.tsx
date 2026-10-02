import { useState, useEffect } from 'react';
import { Plus, Check, Heart, ListMusic } from 'lucide-react';
import { Sheet } from './SheetHost';
import type { Song } from '@/store/player';
import { playlists } from '@/api/endpoints';
import { useUIStore } from '@/store/ui';
import Button from './Button';
import Input from './Input';

interface SaveToPlaylistSheetProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SaveToPlaylistSheet({ song, isOpen, onClose }: SaveToPlaylistSheetProps) {
  const addToast = useUIStore((s) => s.addToast);

  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());

  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [placeholderName, setPlaceholderName] = useState('Playlist 1');

  useEffect(() => {
    if (isOpen && song) {
      playlists.list()
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res?.items || [];
          setUserPlaylists(list);
        })
        .catch(() => {});

      playlists.nameSuggestion()
        .then((sRes: any) => {
          if (sRes?.suggestion || sRes?.name) {
            setPlaceholderName(sRes.suggestion || sRes.name);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, song]);

  if (!song) return null;

  const togglePlaylist = async (playlistId: string) => {
    const next = new Set(selectedPlaylists);
    const exists = next.has(playlistId);

    if (exists) next.delete(playlistId);
    else next.add(playlistId);

    setSelectedPlaylists(next);

    try {
      if (playlistId === 'liked') {
        await playlists.like(song.id, !exists);
      } else {
        await playlists.saveSong({ songId: song.id, playlistId });
      }
    } catch (_e) {
      addToast('Failed to update playlist', 'error');
    }
  };

  const handleCreateInline = async () => {
    try {
      const name = newPlaylistName.trim() || placeholderName;
      const res = await playlists.create({ name });
      const newId = res.id || res._id;
      await playlists.saveSong({ songId: song.id, playlistId: newId });

      addToast(`Saved to ${name}`, 'success');
      setIsCreatingInline(false);
      setNewPlaylistName('');
      onClose();
    } catch (_e) {
      addToast('Failed to create playlist', 'error');
    }
  };

  return (
    <Sheet id="save-to-playlist-sheet" isOpen={isOpen} onClose={onClose} title="Save to playlist">
      <div className="flex flex-col gap-4 py-2">
        {!isCreatingInline ? (
          <button
            onClick={() => setIsCreatingInline(true)}
            className="w-full h-[64px] px-3 rounded-[16px] hover:bg-surface-2 flex items-center gap-4 text-left transition-colors"
          >
            <div className="w-[44px] h-[44px] rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm flex-shrink-0">
              <Plus size={22} />
            </div>
            <span className="t-h3 text-[16px] font-bold text-text">New playlist</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2 p-3 bg-surface-2 rounded-[20px] border border-line">
            <Input
              label="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder={placeholderName}
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsCreatingInline(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateInline}>
                Create
              </Button>
            </div>
          </div>
        )}

        <div
          onClick={() => togglePlaylist('liked')}
          className="w-full h-[64px] px-3 rounded-[16px] hover:bg-surface-2 flex items-center justify-between cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-[48px] h-[48px] rounded-[14px] bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white flex-shrink-0">
              <Heart size={22} />
            </div>
            <span className="t-h3 text-[16px] font-bold text-text">Liked Songs</span>
          </div>
          {selectedPlaylists.has('liked') && <Check size={20} className="text-primary" />}
        </div>

        <div className="flex flex-col divide-y divide-line/20">
          {userPlaylists.map((pl) => {
            const plId = pl.id || pl._id;
            const isSelected = selectedPlaylists.has(plId);
            return (
              <div
                key={plId}
                onClick={() => togglePlaylist(plId)}
                className="w-full h-[64px] px-3 flex items-center justify-between cursor-pointer hover:bg-surface-2 rounded-[16px] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-[48px] h-[48px] rounded-[14px] overflow-hidden bg-surface-2 flex items-center justify-center text-muted flex-shrink-0">
                    {pl.artwork ? (
                      <img src={pl.artwork} alt={pl.name} className="w-full h-full object-cover" />
                    ) : (
                      <ListMusic size={22} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="t-h3 text-[15px] font-bold text-text truncate">{pl.name}</h3>
                    <p className="t-cap text-[12px] text-muted truncate">{pl.trackCount || 0} songs</p>
                  </div>
                </div>
                {isSelected && <Check size={20} className="text-primary" />}
              </div>
            );
          })}
        </div>

        <Button size="lg" onClick={onClose} className="w-full mt-4">
          Done
        </Button>
      </div>
    </Sheet>
  );
}
