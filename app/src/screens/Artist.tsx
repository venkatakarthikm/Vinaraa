import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { music } from '@/api/endpoints';
import { ChevronLeft, Play, Mic2 } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import { getSongImage } from '@/utils/image';
import { listStaggerVariants } from '@/motion';

export default function Artist() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);

  useEffect(() => {
    if (!id) return;
    setArtist(null);
    setPage(0);
    setHasMore(false);
    setLoading(true);
    music.artist(id, { page: 0, songCount: 50, albumCount: 50 })
      .then((d) => { setArtist(d); setHasMore((d?.upstreamTopSongs?.length || 0) === 50); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || page === 0) return;
    setLoadingMore(true);
    music.artist(id, { page, songCount: 50, albumCount: 50 }).then(d => {
      setArtist((prev: any) => {
        if (!prev) {
          setHasMore((d?.upstreamTopSongs?.length || 0) > 0);
          return d;
        }
        // Merge songs
        const currentSongs = [...(prev.upstreamTopSongs || [])];
        const newSongs = d.upstreamTopSongs || [];
        const existingIds = new Set(currentSongs.map(s => s.id));
        const filteredNew = newSongs.filter((s: any) => !existingIds.has(s.id));
        
        setHasMore(newSongs.length > 0 && filteredNew.length > 0);
        return {
          ...prev,
          upstreamTopSongs: [...currentSongs, ...filteredNew]
        };
      });
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [page, id]);

  const allSongs = [...(artist?.topSongs || []), ...(artist?.upstreamTopSongs || [])].filter(
    (s, idx, self) => self.findIndex((x: any) => x.id === s.id) === idx
  );

  const handlePlay = (idx = 0) => {
    if (!allSongs.length) return;
    setQueue(allSongs.map((s: any) => formatPlayerSong(s)), idx);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">

        {/* Hero — tall bleed image */}
        <div className="relative" style={{ height: 320 }}>
          {loading ? (
            <div className="absolute inset-0 shimmer" />
          ) : artist?.image ? (
            <img src={artist.image} alt={artist.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(139,61,255,0.2), rgba(255,61,142,0.15))' }}>
              <Mic2 size={72} style={{ color: 'var(--color-primary-soft)' }} />
            </div>
          )}
          {/* Deep gradient scrim */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 50%, #090714 100%)' }} />

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute left-4 z-20 p-2.5 rounded-full"
            style={{ top: `calc(env(safe-area-inset-top) + 12px)`, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
            aria-label="Back"
          >
            <ChevronLeft size={22} color="white" />
          </button>

          {/* Name + stats overlay */}
          {!loading && (
            <div className="absolute bottom-5 left-5 right-5">
              <h1 className="text-4xl font-black text-white drop-shadow-xl leading-tight mb-1">{artist?.name}</h1>
              {artist?.followerCount > 0 && (
                <p className="text-white/60 text-sm font-medium">{artist.followerCount.toLocaleString()} listeners</p>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex gap-3 px-5 py-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handlePlay(0)}
            disabled={loading}
            className="flex-1 text-white font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', boxShadow: '0 8px 24px rgba(139,61,255,0.35)' }}
          >
            <Play size={18} fill="white" />Play
          </motion.button>
          <button
            className="px-5 py-3.5 rounded-2xl font-bold text-sm"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid rgba(40,36,77,0.6)' }}
          >
            Follow
          </button>
        </div>

        {/* Popular Songs */}
        <div className="px-4 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider px-1 mb-2" style={{ color: 'var(--color-muted)' }}>Popular Songs</p>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SongRowSkeleton key={i} />)
            : allSongs.map((song: any, i: number) => (
                <motion.button
                  key={song.id || song.saavnId}
                  custom={i}
                  variants={listStaggerVariants}
                  initial="initial"
                  animate="animate"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePlay(i)}
                  className="flex items-center gap-3 py-3 w-full rounded-xl hover:bg-white/5 px-2"
                >
                  <span className="w-5 text-xs text-right flex-shrink-0 font-bold" style={{ color: 'var(--color-muted)' }}>{i + 1}</span>
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--color-surface-2)' }}>
                    {getSongImage(song) && <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>{song.name}</p>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-muted)' }}>{song.album?.name || ''}</p>
                  </div>
                </motion.button>
              ))
          }
          {!loading && hasMore && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setPage(p => p + 1)}
              disabled={loadingMore}
              className="w-full mt-2 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{ background: loadingMore ? 'rgba(255,255,255,0.05)' : 'var(--color-surface-2)', color: 'var(--color-text)' }}
            >
              {loadingMore ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : 'Load More'}
            </motion.button>
          )}
        </div>

        {/* Albums rail */}
        {!loading && artist?.albums?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider px-5 mb-3" style={{ color: 'var(--color-muted)' }}>Albums</p>
            <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-4">
              {artist.albums.map((alb: any, i: number) => (
                <motion.button
                  key={alb.id}
                  custom={i}
                  variants={listStaggerVariants}
                  initial="initial"
                  animate="animate"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/album/${alb.id}`)}
                  className="flex-shrink-0 w-36 text-left"
                >
                  <div className="w-36 h-36 rounded-2xl overflow-hidden mb-2" style={{ background: 'var(--color-surface-2)' }}>
                    {alb.image && <img src={alb.image} alt={alb.name} className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>{alb.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{alb.year}</p>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
