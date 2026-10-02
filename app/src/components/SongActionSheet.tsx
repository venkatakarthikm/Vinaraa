import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ListPlus, Plus, Download, Share2, Trash2 } from 'lucide-react';
import { springs } from '@/motion';
import { usePlayerStore } from '@/store/player';
import { playlists } from '@/api/endpoints';
import { VinaraaPlayer } from '@/native/player';
import { useUIStore } from '@/store/ui';
import { saveDownloadedSong } from '@/utils/offline';

interface SongActionSheetProps {
  song: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRemoveFromPlaylist?: () => void;
}

import { useShallow } from 'zustand/react/shallow';

export default function SongActionSheet({ song, isOpen, onClose, onRemoveFromPlaylist }: SongActionSheetProps) {
  const { appendToQueue, playNext } = usePlayerStore(
    useShallow((s) => ({
      appendToQueue: s.appendToQueue,
      playNext: s.playNext,
    }))
  );
  const { addToast } = useUIStore();
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [suggestedName, setSuggestedName] = useState('');

  if (!isOpen || !song) return null;

  const handlePlayNext = () => {
    playNext(song);
    addToast('Playing next', 'success');
    onClose();
  };

  const handleAddToQueue = () => {
    appendToQueue([song]);
    addToast('Added to queue', 'success');
    onClose();
  };

  const handleDownload = async () => {
    if (!song?.streamUrl) {
      addToast('Download URL unavailable', 'error');
      return;
    }
    try {
      addToast(`Downloading ${song.name}…`, 'info');
      const safeName = song.name.replace(/[^a-zA-Z0-9.\-_ \(\)]/g, '');
      await VinaraaPlayer.download({
        url: song.streamUrl,
        title: song.name,
        fileName: `${safeName}.mp3`,
      });
      await saveDownloadedSong({
        id: song.id,
        name: song.name,
        artist: song.artist,
        image: song.image,
        durationMs: song.durationMs,
        streamUrl: song.streamUrl,
        downloadedAt: Date.now(),
      });
      addToast('Download started', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Download failed', 'error');
    }
    onClose();
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Listen to ${song.name}`, url: window.location.href });
      }
    } catch (_e) { }
    onClose();
  };

  const handleSaveToPlaylistClick = async () => {
    setShowSaveSheet(true);
    try {
      const [plRes, nameRes] = await Promise.all([playlists.list(), playlists.nameSuggestion()]);
      setUserPlaylists(Array.isArray(plRes) ? plRes.filter((p: any) => !p.isSystem) : (plRes?.items || []).filter((p: any) => !p.isSystem));
      setSuggestedName(nameRes?.suggestedName || 'New Playlist');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToPlaylist = async (playlistId?: string) => {
    try {
      const targetSongId = song.id || song.saavnId || song.songId;
      if (playlistId) {
        await playlists.saveSong({ songId: targetSongId, playlistId });
      } else {
        await playlists.saveSong({ songId: targetSongId, newPlaylistName: suggestedName });
      }
      setShowSaveSheet(false);
      addToast('Added to playlist', 'success');
      onClose();
    } catch (e: any) {
      addToast(e?.message || 'Failed to add to playlist', 'error');
    }
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
          className="bg-surface/95 backdrop-blur-2xl border-t border-border/80 rounded-t-3xl pb-safe flex flex-col relative z-10 shadow-2xl overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={springs.sheet}
        >
          <div className="p-5 flex flex-col gap-4">
            <div className="w-12 h-1.5 bg-border rounded-full opacity-50 mx-auto" />

            {/* Song Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-border/50">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-2 flex-shrink-0">
                {song.image && <img src={song.image} alt={song.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text font-bold text-base line-clamp-1">{song.name}</p>
                <p className="text-muted text-xs line-clamp-1">{song.artist}</p>
              </div>
            </div>

            {/* Actions List */}
            <div className="flex flex-col gap-1">
              <button
                onClick={handlePlayNext}
                className="flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-surface-2 transition-colors text-text font-semibold text-sm"
              >
                <Play size={18} className="text-primary-soft" />
                Play Next
              </button>
              <button
                onClick={handleAddToQueue}
                className="flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-surface-2 transition-colors text-text font-semibold text-sm"
              >
                <ListPlus size={18} className="text-primary-soft" />
                Add to Queue
              </button>
              <button
                onClick={handleSaveToPlaylistClick}
                className="flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-surface-2 transition-colors text-text font-semibold text-sm"
              >
                <Plus size={18} className="text-primary-soft" />
                Add to Playlist
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-surface-2 transition-colors text-text font-semibold text-sm"
              >
                <Download size={18} className="text-primary-soft" />
                Download Song
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-surface-2 transition-colors text-text font-semibold text-sm"
              >
                <Share2 size={18} className="text-primary-soft" />
                Share
              </button>

              {onRemoveFromPlaylist && (
                <button
                  onClick={() => {
                    onRemoveFromPlaylist();
                    onClose();
                  }}
                  className="flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-danger/20 transition-colors text-danger font-semibold text-sm mt-1"
                >
                  <Trash2 size={18} />
                  Remove from Playlist
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Nested Add to Playlist Sheet */}
        <AnimatePresence>
          {showSaveSheet && (
            <div className="absolute inset-0 z-50 flex flex-col justify-end">
              <motion.div
                className="absolute inset-0 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSaveSheet(false)}
              />
              <motion.div
                className="bg-surface border-t border-border rounded-t-3xl pb-safe flex flex-col max-h-[60vh] relative z-10 shadow-2xl p-5"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={springs.sheet}
              >
                <h3 className="text-text font-bold text-lg mb-4">Save to Playlist</h3>
                <div className="flex-1 overflow-y-auto scroll-y">
                  <button
                    onClick={() => handleAddToPlaylist()}
                    className="flex items-center gap-4 py-3 w-full border-b border-border mb-2"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Plus size={20} className="text-primary-soft" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-text font-bold text-sm">New Playlist</p>
                      <p className="text-muted text-xs">{suggestedName}</p>
                    </div>
                  </button>
                  {userPlaylists.map((pl) => (
                    <button
                      key={pl.id || pl._id}
                      onClick={() => handleAddToPlaylist(pl.id || pl._id)}
                      className="flex items-center gap-4 py-3 w-full"
                    >
                      <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {pl.coverImageUrl || pl.artwork ? (
                          <img
                            src={pl.coverImageUrl || pl.artwork}
                            alt={pl.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-muted text-sm">🎵</span>
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-text font-bold text-sm">{pl.name}</p>
                        <p className="text-muted text-xs">{pl.trackCount || 0} songs</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
