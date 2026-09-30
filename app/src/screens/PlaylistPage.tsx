import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { playlists } from '@/api/endpoints';
import { ChevronLeft, Play, Shuffle, Trash2, Globe } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { SongRowSkeleton } from '@/components/Skeleton';
import MiniPlayer from '@/components/MiniPlayer';

export default function PlaylistPage() {
  const [_id] = useState('');
  const { id } = { id: window.location.pathname.split('/').pop() };
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setShowPlayer = usePlayerStore((s) => s.setShowPlayer);

  useEffect(() => {
    if (!id) return;
    playlists.get(id).then((d) => { setPlaylist(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const handlePlay = (startIndex = 0) => {
    if (!playlist?.songs?.length) return;
    const songs = playlist.songs.map((s: any) => ({
      id: s.id || s.saavnId,
      name: s.name,
      artist: (s.singers || s.artists || []).map((a: any) => a.name).join(', '),
      image: s.image,
      durationMs: s.durationMs,
    }));
    setQueue(songs, startIndex);
    setShowPlayer(true);
    navigate('/player');
  };

  const removeSong = async (songId: string) => {
    if (!id) return;
    await playlists.removeTrack(id, { songIds: [songId] });
    setPlaylist((pl: any) => ({ ...pl, songs: pl.songs.filter((s: any) => (s.id || s.saavnId) !== songId) }));
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        <div className="relative h-64">
          {playlist?.artwork && <img src={playlist.artwork} alt={playlist.name} className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-bg" />
          <button onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-2.5 rounded-full bg-black/40 backdrop-blur-sm"
            style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <ChevronLeft size={22} className="text-white" />
          </button>
        </div>
        <div className="px-5 -mt-4">
          {loading ? (
            <><div className="shimmer h-7 w-48 rounded mb-2" /><div className="shimmer h-4 w-32 rounded mb-6" /></>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-text mb-1">{playlist?.name}</h1>
              <div className="flex items-center gap-2 mb-4 text-xs text-muted">
                {playlist?.isPublic && <Globe size={12} />}
                <span>{playlist?.songs?.length || 0} songs</span>
                {playlist?.isSystem && <span className="bg-primary/20 text-primary-soft px-2 py-0.5 rounded-pill">System</span>}
              </div>
              <div className="flex gap-3 mb-5">
                <button onClick={() => handlePlay(0)}
                  className="flex-1 bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-3 flex items-center justify-center gap-2 shadow-colored">
                  <Play size={18} fill="white" />Play
                </button>
                <button onClick={() => handlePlay(Math.floor(Math.random() * (playlist?.songs?.length || 1)))}
                  className="flex-1 bg-surface-2 border border-border text-text font-bold rounded-pill py-3 flex items-center justify-center gap-2">
                  <Shuffle size={18} />Shuffle
                </button>
              </div>
              <h2 className="text-text font-bold mb-3">Songs</h2>
              {playlist?.songs?.map((song: any, i: number) => (
                <div key={song.id || song.saavnId} className="flex items-center gap-3 py-3">
                  <button onClick={() => handlePlay(i)} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
                      {song.image && <img src={song.image} alt={song.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-text text-sm font-semibold line-clamp-1">{song.name}</p>
                      <p className="text-muted text-xs line-clamp-1">
                        {(song.singers || song.artists || []).map((a: any) => a.name).join(', ')}
                      </p>
                    </div>
                  </button>
                  {!playlist?.isSystem && (
                    <button onClick={() => removeSong(song.id || song.saavnId)} className="p-2 text-muted flex-shrink-0" aria-label="Remove">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
          {loading && Array.from({ length: 6 }).map((_, i) => <SongRowSkeleton key={i} />)}
        </div>
        <div className="h-4" />
      </div>
      <MiniPlayer />
    </div>
  );
}
