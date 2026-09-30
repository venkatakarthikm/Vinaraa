import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { listStaggerVariants } from '@/motion';
import { recommendations, music } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useNavigate } from 'react-router-dom';
import { SongRowSkeleton, CardSkeleton } from '@/components/Skeleton';
import { Bell, TrendingUp, Play, ChevronRight } from 'lucide-react';
import MiniPlayer from '@/components/MiniPlayer';
import { getSongImage } from '@/utils/image';
import { formatPlayerSong, getArtistsText } from '@/utils/song';

interface FeedRail {
  id: string;
  title: string;
  items: any[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function SongCard({ song, onPlay, index }: { song: any; onPlay: (s: any) => void; index: number }) {
  return (
    <motion.button
      custom={index} variants={listStaggerVariants} initial="initial" animate="animate"
      whileTap={{ scale: 0.97 }} onClick={() => onPlay(song)} className="flex-shrink-0 w-36"
    >
      <div className="relative w-36 h-36 rounded-2xl overflow-hidden mb-2">
        {getSongImage(song) ? <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-surface-2 flex items-center justify-center"><Play size={24} className="text-muted" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 right-2 bg-primary/80 rounded-full p-1.5">
          <Play size={12} fill="white" className="text-white" />
        </div>
      </div>
      <p className="text-text text-xs font-semibold line-clamp-1">{song.name}</p>
      <p className="text-muted text-[11px] line-clamp-1">
        {getArtistsText(song)}
      </p>
      {song.matchPercent && (
        <span className="inline-block mt-1 bg-mint/20 text-mint text-[10px] font-bold px-2 py-0.5 rounded-pill">
          {song.matchPercent}% match
        </span>
      )}
    </motion.button>
  );
}

function SongRow({ song, index, onPlay }: { song: any; index: number; onPlay: (s: any) => void }) {
  return (
    <motion.button
      custom={index} variants={listStaggerVariants} initial="initial" animate="animate"
      whileTap={{ scale: 0.98 }} onClick={() => onPlay(song)} className="flex items-center gap-3 px-4 py-3 w-full"
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
        {getSongImage(song) && <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-text text-sm font-semibold line-clamp-1">{song.name}</p>
        <p className="text-muted text-xs line-clamp-1">
          {getArtistsText(song)}
        </p>
      </div>
      {song.durationMs && (
        <span className="text-muted text-xs flex-shrink-0">
          {Math.floor(song.durationMs / 60000)}:{String(Math.floor((song.durationMs % 60000) / 1000)).padStart(2, '0')}
        </span>
      )}
    </motion.button>
  );
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [feed, setFeed] = useState<FeedRail[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToast } = useUIStore();

  const loadData = async () => {
    try {
      const [feedData, trendingData] = await Promise.allSettled([
        recommendations.feed(),
        music.trending(),
      ]);
      if (feedData.status === 'fulfilled') setFeed(feedData.value?.rails || []);
      if (trendingData.status === 'fulfilled') setTrending(trendingData.value?.items || []);
    } catch {
      addToast('Could not load music. Check your connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handlePlay = (song: any) => {
    const playerSong = formatPlayerSong(song);
    usePlayerStore.getState().setQueue([playerSong]);
    usePlayerStore.getState().setShowPlayer(true);
    navigate(`/player/${playerSong.id}`, { state: { song } });
  };

  return (
    <div className="flex flex-col h-full bg-bg overflow-hidden">
      <div className="flex-1 scroll-y overflow-y-auto pb-safe">
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <div>
            <p className="text-muted text-sm">{getGreeting()}</p>
            <h1 className="text-2xl font-bold text-text">{user?.name || 'Music Lover'} 👋</h1>
          </div>
          <div className="flex gap-2">
            <button className="p-2.5 rounded-full bg-surface-2 border border-border" aria-label="Notifications">
              <Bell size={20} className="text-muted" />
            </button>
            <button onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"
              aria-label="Profile">
              <span className="text-white font-bold text-sm">{(user?.name || 'U')[0].toUpperCase()}</span>
            </button>
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between px-5 mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-accent" />
              <h2 className="text-text font-bold">Trending Now</h2>
            </div>
            <button className="text-primary-soft text-xs font-semibold flex items-center gap-1" aria-label="See all trending">
              All <ChevronRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-2">
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-2">
              {trending.filter((v, i, a) => a.findIndex(t => (t.id || t.saavnId || t._id) === (v.id || v.saavnId || v._id)) === i).slice(0, 10).map((song, i) => (
                <SongCard key={song.id || song.saavnId} song={song} onPlay={handlePlay} index={i} />
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-6 px-4">
            <div className="shimmer h-5 w-40 rounded mb-4" />
            {Array.from({ length: 4 }).map((_, i) => <SongRowSkeleton key={i} />)}
          </div>
        ) : (
          feed.map((rail) => (
            <div key={rail.id} className="mt-6">
              <h2 className="text-text font-bold px-5 mb-3">{rail.title}</h2>
              {rail.items.filter((v: any, i: number, a: any[]) => a.findIndex(t => (t.id || t.saavnId || t._id) === (v.id || v.saavnId || v._id)) === i).slice(0, 8).map((song: any, i: number) => (
                <SongRow key={song.id || song.saavnId} song={song} index={i} onPlay={handlePlay} />
              ))}
            </div>
          ))
        )}

        {!loading && feed.length === 0 && trending.length > 0 && (
          <div className="mt-6">
            <h2 className="text-text font-bold px-5 mb-3">Top Songs</h2>
            {trending.filter((v, i, a) => a.findIndex(t => (t.id || t.saavnId || t._id) === (v.id || v.saavnId || v._id)) === i).slice(0, 20).map((song, i) => (
              <SongRow key={song.id || song.saavnId} song={song} index={i} onPlay={handlePlay} />
            ))}
          </div>
        )}
        <div className="h-8" />
      </div>
      <MiniPlayer />
    </div>
  );
}
