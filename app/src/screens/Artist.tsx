import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { music } from '@/api/endpoints';
import { ChevronLeft, Play, Heart } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { SongRowSkeleton } from '@/components/Skeleton';
import MiniPlayer from '@/components/MiniPlayer';

export default function Artist() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setShowPlayer = usePlayerStore((s) => s.setShowPlayer);

  useEffect(() => {
    if (!id) return;
    music.artist(id).then((d) => { setArtist(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const allSongs = [...(artist?.topSongs || []), ...(artist?.upstreamTopSongs || [])].filter(
    (s, idx, self) => self.findIndex((x: any) => x.id === s.id) === idx
  );

  const handlePlay = (idx = 0) => {
    if (!allSongs.length) return;
    const songs = allSongs.map((s: any) => ({
      id: s.id || s.saavnId,
      name: s.name,
      artist: artist?.name,
      image: s.image,
      durationMs: s.durationMs,
    }));
    setQueue(songs, idx);
    setShowPlayer(true);
    navigate('/player');
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        <div className="relative h-80">
          {artist?.image && (
            <img src={artist.image} alt={artist.name} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-bg" />
          <button onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-2.5 rounded-full bg-black/40 backdrop-blur-sm"
            style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <ChevronLeft size={22} className="text-white" />
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <h1 className="text-4xl font-bold text-white mb-1">{loading ? '…' : artist?.name}</h1>
            {artist?.followerCount > 0 && (
              <p className="text-white/70 text-sm">{artist.followerCount.toLocaleString()} listeners</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4">
          <button onClick={() => handlePlay(0)}
            className="flex-1 bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-3 flex items-center justify-center gap-2 shadow-colored">
            <Play size={18} fill="white" />Play
          </button>
          <button className="px-5 py-3 bg-surface-2 border border-border text-text font-bold rounded-pill">Follow</button>
        </div>
        <div className="bg-surface rounded-t-[32px] min-h-96 px-5 pt-5">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-text font-bold text-lg">Popular Songs</h2>
            </div>
            {loading ? Array.from({ length: 5 }).map((_, i) => <SongRowSkeleton key={i} />) : (
              allSongs.slice(0, 8).map((song: any, i: number) => (
                <button key={song.id || song.saavnId} onClick={() => handlePlay(i)}
                  className="flex items-center gap-3 py-3 w-full">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
                    {song.image && <img src={song.image} alt={song.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-text text-sm font-semibold line-clamp-1">{song.name}</p>
                    <p className="text-muted text-xs">{song.album?.name || ''}</p>
                  </div>
                  <button className="p-2 text-muted" onClick={(e) => e.stopPropagation()} aria-label="Like">
                    <Heart size={18} />
                  </button>
                </button>
              ))
            )}
          </div>
          {artist?.albums?.length > 0 && (
            <div>
              <h2 className="text-text font-bold text-lg mb-3">Albums</h2>
              <div className="flex gap-4 overflow-x-auto scroll-x pb-4">
                {artist.albums.map((alb: any) => (
                  <button key={alb.id} onClick={() => navigate(`/album/${alb.id}`)} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 rounded-2xl overflow-hidden bg-surface-2 mb-2">
                      {alb.image && <img src={alb.image} alt={alb.name} className="w-full h-full object-cover" />}
                    </div>
                    <p className="text-text text-xs font-semibold line-clamp-2">{alb.name}</p>
                    <p className="text-muted text-[11px]">{alb.year}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <MiniPlayer />
    </div>
  );
}
