import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { playlists, music } from '@/api/endpoints';
import { ChevronLeft, Play, Shuffle, Globe } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import SongRow from '@/components/SongRow';

export default function PlaylistPage() {
  const { id } = { id: window.location.pathname.split('/').pop() };
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setShowPlayer = usePlayerStore((s) => s.setShowPlayer);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    playlists
      .get(id)
      .then((d) => {
        if (d && (d.tracks?.length || d.songs?.length)) {
          setPlaylist(d);
          setLoading(false);
        } else {
          return music.editorialPlaylist(id);
        }
      })
      .then((ed) => {
        if (ed) {
          const declared = Number(/(\d+)\s+songs/.exec(ed.description || '')?.[1] || 0);
          if (declared && (ed.songs || []).length < declared) {
            console.warn(`[playlist] truncated: got ${(ed.songs || []).length} of ${declared}`);
          }
          setPlaylist(ed);
        }
        setLoading(false);
      })
      .catch(() => {
        music
          .editorialPlaylist(id)
          .then((ed) => {
            if (ed) {
              setPlaylist(ed);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
  }, [id]);

  const playlistSongs = playlist?.tracks || playlist?.songs || [];

  const handlePlay = (startIndex = 0) => {
    if (!playlistSongs.length) return;
    const songs = playlistSongs.map((s: any) => formatPlayerSong(s));
    setQueue(songs, startIndex);
    setShowPlayer(true);
    navigate('/player');
  };

  const removeSong = async (songId: string) => {
    if (!id) return;
    await playlists.removeTrack(id, { songIds: [songId] });
    setPlaylist((pl: any) => ({
      ...pl,
      tracks: (pl.tracks || pl.songs || []).filter(
        (s: any) => (s.songId || s.id || s.saavnId) !== songId
      ),
      songs: (pl.songs || []).filter(
        (s: any) => (s.songId || s.id || s.saavnId) !== songId
      ),
    }));
  };

  const coverUrl =
    playlist?.coverImageUrl ||
    playlist?.artwork ||
    (Array.isArray(playlist?.image) ? playlist.image[playlist.image.length - 1]?.url : null);

  const canRemove = !playlist?.isSystem && playlist?.isOwner === true;

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        <div className="relative h-64">
          {coverUrl && (
            <img src={coverUrl} alt={playlist?.name} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-bg" />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-2.5 rounded-full bg-black/40 backdrop-blur-sm z-20"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
          >
            <ChevronLeft size={22} className="text-white" />
          </button>
        </div>
        <div className="relative z-10 px-5 -mt-4">
          {loading ? (
            <>
              <div className="shimmer h-7 w-48 rounded mb-2" />
              <div className="shimmer h-4 w-32 rounded mb-6" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-text mb-1">{playlist?.name}</h1>
              <div className="flex items-center gap-2 mb-4 text-xs text-muted">
                {playlist?.visibility === 'public' && <Globe size={12} />}
                <span>{playlistSongs.length || playlist?.songCount || 0} songs</span>
                {playlist?.isSystem && (
                  <span className="bg-primary/20 text-primary-soft px-2 py-0.5 rounded-pill">System</span>
                )}
              </div>
              <div className="flex gap-3 mb-5">
                <button
                  onClick={() => handlePlay(0)}
                  className="flex-1 bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-3 flex items-center justify-center gap-2 shadow-colored"
                >
                  <Play size={18} fill="white" /> Play
                </button>
                <button
                  onClick={() => handlePlay(Math.floor(Math.random() * (playlistSongs.length || 1)))}
                  className="flex-1 bg-surface-2 border border-border text-text font-bold rounded-pill py-3 flex items-center justify-center gap-2"
                >
                  <Shuffle size={18} /> Shuffle
                </button>
              </div>
              <h2 className="text-text font-bold mb-3">Songs</h2>
              <div className="flex flex-col gap-1">
                {playlistSongs.map((song: any, i: number) => {
                  const formatted = formatPlayerSong(song);
                  const songId = song.songId || song.id || song.saavnId;
                  return (
                    <SongRow
                      key={songId || i}
                      song={formatted}
                      onPlay={() => handlePlay(i)}
                      onRemoveFromPlaylist={canRemove ? () => removeSong(songId) : undefined}
                    />
                  );
                })}
              </div>
            </>
          )}
          {loading && Array.from({ length: 6 }).map((_, i) => <SongRowSkeleton key={i} />)}
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
