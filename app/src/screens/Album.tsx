import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { music } from '@/api/endpoints';
import { ChevronLeft, Play, Shuffle } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { SongRowSkeleton } from '@/components/Skeleton';
import MiniPlayer from '@/components/MiniPlayer';
import { formatPlayerSong, getArtistsText } from '@/utils/song';
import { getSongImage } from '@/utils/image';

export default function Album() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setShowPlayer = usePlayerStore((s) => s.setShowPlayer);

  useEffect(() => {
    if (!id) return;
    music.album(id).then((d) => { setAlbum(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const handlePlay = (startIndex = 0) => {
    if (!album?.songs?.length) return;
    const songs = album.songs.map((s: any) => formatPlayerSong(s));
    setQueue(songs, startIndex);
    setShowPlayer(true);
    navigate('/player');
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        <div className="relative h-72">
          {album?.image && (
            <img src={album.image} alt={album.name} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-bg/60 to-bg" />
          <button onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-2.5 rounded-full bg-black/40 backdrop-blur-sm"
            style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <ChevronLeft size={22} className="text-white" />
          </button>
        </div>
        <div className="px-5 -mt-4">
          {loading ? (
            <>
              <div className="shimmer h-7 w-48 rounded mb-2" />
              <div className="shimmer h-4 w-32 rounded mb-6" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-text mb-1">{album?.name}</h1>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {album?.language && (
                  <span className="text-xs bg-surface-2 text-muted px-3 py-1 rounded-pill border border-border capitalize">{album.language}</span>
                )}
                {album?.year && <span className="text-xs text-muted">{album.year}</span>}
                <span className="text-xs text-muted">{album?.songCount || album?.songs?.length || 0} songs</span>
              </div>
              <div className="flex gap-3 mb-6">
                <button onClick={() => handlePlay(0)}
                  className="flex-1 bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-3 flex items-center justify-center gap-2 shadow-colored">
                  <Play size={18} fill="white" />Play
                </button>
                <button onClick={() => handlePlay(Math.floor(Math.random() * (album?.songs?.length || 1)))}
                  className="flex-1 bg-surface-2 border border-border text-text font-bold rounded-pill py-3 flex items-center justify-center gap-2">
                  <Shuffle size={18} />Shuffle
                </button>
              </div>
              {album?.artists?.length > 0 && (
                <div className="mb-4 flex gap-3 overflow-x-auto scroll-x pb-2">
                  {album.artists.slice(0, 5).map((artist: any) => (
                    <button key={artist.id} onClick={() => navigate(`/artist/${artist.id}`)}
                      className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-2 border-2 border-border">
                        {artist.image && <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />}
                      </div>
                      <span className="text-xs text-muted w-16 text-center line-clamp-2 capitalize">{artist.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <h2 className="text-text font-bold mb-3">Tracks</h2>
          {loading ? Array.from({ length: 8 }).map((_, i) => <SongRowSkeleton key={i} />) : (
            album?.songs?.map((song: any, i: number) => (
              <button key={song.id || song.saavnId} onClick={() => handlePlay(i)}
                className="flex items-center gap-3 py-3 w-full">
                <span className="w-8 text-center text-muted text-sm flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-text text-sm font-semibold line-clamp-1">{song.name}</p>
                  <p className="text-muted text-xs line-clamp-1">
                    {getArtistsText(song)}
                  </p>
                </div>
                <span className="text-muted text-xs flex-shrink-0">
                  {song.durationMs ? `${Math.floor(song.durationMs / 60000)}:${String(Math.floor((song.durationMs % 60000) / 1000)).padStart(2, '0')}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="h-4" />
      </div>
      <MiniPlayer />
    </div>
  );
}
