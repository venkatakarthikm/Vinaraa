import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { music } from '@/api/endpoints';
import { ChevronLeft, Play, Shuffle, Music2 } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import SongRow from '@/components/SongRow';
import { listStaggerVariants } from '@/motion';

export default function Album() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);

  useEffect(() => {
    if (!id) return;
    music.album(id).then((d) => { setAlbum(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const handlePlay = (startIndex = 0) => {
    if (!album?.songs?.length) return;
    setQueue(album.songs.map((s: any) => formatPlayerSong(s)), startIndex);
  };

  const coverImg = album?.image;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">

        {/* Hero artwork */}
        <div className="relative" style={{ height: 280 }}>
          {loading ? (
            <div className="absolute inset-0 shimmer" />
          ) : coverImg ? (
            <img src={coverImg} alt={album?.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--color-surface-2)' }}>
              <Music2 size={64} style={{ color: 'var(--color-muted)' }} />
            </div>
          )}
          {/* Gradient scrim */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(9,7,20,0.75) 60%, #090714 100%)' }} />
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute left-4 z-20 p-2.5 rounded-full"
            style={{ top: `calc(env(safe-area-inset-top) + 12px)`, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
            aria-label="Back"
          >
            <ChevronLeft size={22} color="white" />
          </button>
          {/* Title overlay */}
          {!loading && (
            <div className="absolute bottom-4 left-5 right-5">
              <h1 className="text-2xl font-black text-white leading-tight line-clamp-2 mb-1 drop-shadow-lg">{album?.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                {album?.language && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-pill capitalize"
                    style={{ background: 'rgba(139,61,255,0.35)', color: 'var(--color-primary-soft)', backdropFilter: 'blur(6px)' }}>
                    {album.language}
                  </span>
                )}
                {album?.year && <span className="text-white/60 text-xs font-medium">{album.year}</span>}
                <span className="text-white/60 text-xs">{album?.songCount || album?.songs?.length || 0} songs</span>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handlePlay(0)}
            disabled={loading}
            className="flex-1 text-white font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-soft))', boxShadow: '0 8px 24px rgba(139,61,255,0.35)' }}
          >
            <Play size={18} fill="white" />Play
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handlePlay(Math.floor(Math.random() * (album?.songs?.length || 1)))}
            disabled={loading}
            className="flex-1 font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid rgba(40,36,77,0.7)' }}
          >
            <Shuffle size={18} />Shuffle
          </motion.button>
        </div>

        {/* Artists row */}
        {!loading && album?.artists?.length > 0 && (
          <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-3 mb-1">
            {album.artists.slice(0, 6).map((artist: any) => (
              <button key={artist.id} onClick={() => navigate(`/artist/${artist.id}`)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)', border: '2px solid rgba(139,61,255,0.3)' }}>
                  {artist.image && <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />}
                </div>
                <span className="text-[10px] font-medium w-16 text-center line-clamp-1 capitalize" style={{ color: 'var(--color-muted)' }}>{artist.role || artist.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Track list */}
        <div className="px-4">
          <p className="text-xs font-bold uppercase tracking-wider px-1 mb-2" style={{ color: 'var(--color-muted)' }}>Tracks</p>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SongRowSkeleton key={i} />)
            : album?.songs?.map((song: any, i: number) => (
                <motion.div
                  key={song.id || song.saavnId || i}
                  custom={i}
                  variants={listStaggerVariants}
                  initial="initial"
                  animate="animate"
                >
                  <SongRow song={formatPlayerSong(song)} onPlay={() => handlePlay(i)} />
                </motion.div>
              ))
          }
        </div>
        <div className="h-6" />
      </div>
    </div>
  );
}
