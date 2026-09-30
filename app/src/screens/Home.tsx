import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { listStaggerVariants } from '@/motion';
import { recommendations, music } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useNavigate } from 'react-router-dom';
import { SongRowSkeleton, CardSkeleton } from '@/components/Skeleton';
import { Bell, Play, ChevronRight, Music2, Sparkles, Mic2, Film } from 'lucide-react';
import MiniPlayer from '@/components/MiniPlayer';
import { getSongImage } from '@/utils/image';
import { formatPlayerSong, getArtistsText } from '@/utils/song';
import { usePlayerStore } from '@/store/player';

function uniqName(song: any) {
  return (song.name || '').split('(')[0].split('[')[0].trim().toLowerCase();
}

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

function QuickPickCard({ song, onPlay, index, contextQueue }: { song: any; onPlay: (s: any, q: any[]) => void; index: number, contextQueue: any[] }) {
  return (
    <motion.button
      custom={index} variants={listStaggerVariants} initial="initial" animate="animate"
      whileTap={{ scale: 0.95 }}
      onClick={() => onPlay(song, contextQueue)}
      className="flex items-center gap-3 bg-surface-2/60 hover:bg-surface-2 rounded-xl overflow-hidden shadow-sm"
    >
      <div className="w-14 h-14 bg-surface flex-shrink-0 relative">
        {getSongImage(song) ? <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 size={20} className="text-muted" /></div>}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Play size={20} fill="white" className="text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0 pr-3 text-left">
        <p className="text-text text-xs font-bold line-clamp-2 leading-tight">{song.name}</p>
      </div>
    </motion.button>
  );
}

function ArtistCircle({ item, onClick }: { item: any, onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }} onClick={onClick}
      className="flex flex-col items-center gap-2 w-20 flex-shrink-0"
    >
      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-surface-2 shadow-md relative">
        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-surface-2 flex items-center justify-center"><Mic2 size={24} className="text-muted" /></div>}
      </div>
      <p className="text-text text-xs font-semibold line-clamp-1 text-center w-full">{item.name}</p>
    </motion.button>
  );
}

function AlbumSquare({ item, onClick }: { item: any, onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }} onClick={onClick}
      className="flex flex-col gap-2 w-36 flex-shrink-0"
    >
      <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-colored relative">
        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-surface-2 flex items-center justify-center"><Film size={32} className="text-muted" /></div>}
      </div>
      <div className="text-left">
        <p className="text-text text-sm font-bold line-clamp-1">{item.name}</p>
        <p className="text-muted text-[11px] line-clamp-1">{item.description || item.subtitle || 'Album'}</p>
      </div>
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

  const handlePlay = (song: any, contextQueue: any[]) => {
    const queue = contextQueue.map(formatPlayerSong);
    const startIndex = queue.findIndex(s => s.id === (song.id || song.saavnId));
    usePlayerStore.getState().setQueue(queue, startIndex >= 0 ? startIndex : 0);
    usePlayerStore.getState().setShowPlayer(true);
    navigate(`/player/${queue[startIndex >= 0 ? startIndex : 0].id}`, { state: { song } });
  };

  // Mock Music Directors for UI demonstration based on user request
  const MUSIC_DIRECTORS = [
    { id: '455663', name: 'Anirudh', image: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_004_20230323061611_500x500.jpg' },
    { id: '455130', name: 'Thaman S', image: 'https://c.saavncdn.com/artists/S._Thaman_002_20231019124439_500x500.jpg' },
    { id: '456070', name: 'DSP', image: 'https://c.saavncdn.com/artists/Devi_Sri_Prasad_002_20230807185012_500x500.jpg' },
    { id: '459320', name: 'A.R. Rahman', image: 'https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg' },
    { id: '455115', name: 'M.M. Keeravaani', image: 'https://c.saavncdn.com/artists/M_M_Keeravaani_002_20230323061239_500x500.jpg' },
  ];

  const uniqueTrending = trending.filter((v, i, a) => a.findIndex(t => (t.id || t.saavnId || t._id) === (v.id || v.saavnId || v._id) || uniqName(t) === uniqName(v)) === i);
  const quickPicks = uniqueTrending.slice(0, 6);
  const topSongs = uniqueTrending.slice(6, 20);

  return (
    <div className="flex flex-col h-full bg-bg overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/10 to-bg z-0 pointer-events-none" />
      
      <div className="flex-1 scroll-y overflow-y-auto pb-24 z-10">
        <div className="flex items-center justify-between px-5 pt-8 pb-6">
          <div>
            <p className="text-muted text-sm font-medium mb-0.5 flex items-center gap-1">
              <Sparkles size={14} className="text-accent" /> {getGreeting()}
            </p>
            <h1 className="text-3xl font-extrabold text-text tracking-tight">{user?.name?.split(' ')[0] || 'Music Lover'}</h1>
          </div>
          <div className="flex gap-3">
            <button className="p-2.5 rounded-full bg-surface-2/80 backdrop-blur-md border border-white/5 shadow-sm" aria-label="Notifications">
              <Bell size={22} className="text-text" />
            </button>
            <button onClick={() => navigate('/profile')}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-colored border-2 border-bg"
              aria-label="Profile">
              <span className="text-white font-bold text-base">{(user?.name || 'U')[0].toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* Quick Picks */}
        <div className="px-5 mb-8">
          <h2 className="text-text font-bold text-lg mb-3">Quick Picks</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {quickPicks.map((song, i) => (
                <QuickPickCard key={song.id || song.saavnId} song={song} onPlay={handlePlay} index={i} contextQueue={quickPicks} />
              ))}
            </div>
          )}
        </div>

        {/* Music Directors */}
        <div className="mb-8">
          <div className="flex items-center justify-between px-5 mb-4">
            <h2 className="text-text font-bold text-lg">Music Directors</h2>
            <ChevronRight size={20} className="text-muted" />
          </div>
          <div className="flex gap-5 px-5 overflow-x-auto scroll-x pb-4 pt-1">
            {MUSIC_DIRECTORS.map((artist) => (
              <ArtistCircle key={artist.id} item={artist} onClick={() => navigate(`/artist/${artist.id}`)} />
            ))}
          </div>
        </div>

        {/* Dynamic Rails from Backend */}
        {loading ? (
          <div className="mt-6 px-5">
            <div className="shimmer h-6 w-40 rounded mb-4" />
            <div className="flex gap-4 overflow-x-hidden">
              {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          feed.map((rail: any) => (
            <div key={rail.key || rail.id} className="mb-8">
              <div className="flex items-center justify-between px-5 mb-3">
                <div>
                  <h2 className="text-text font-bold text-lg">{rail.title}</h2>
                  {rail.subtitle && <p className="text-muted text-[11px] font-medium leading-tight mt-0.5 max-w-[85%]">{rail.subtitle}</p>}
                </div>
                <ChevronRight size={20} className="text-muted flex-shrink-0" />
              </div>
              <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-4">
                {rail.items.slice(0, 10).map((item: any, i: number) => {
                  if (item.type === 'song') {
                    return (
                      <motion.button
                        key={item.id} whileTap={{ scale: 0.95 }}
                        onClick={() => handlePlay(item, rail.items.filter(x => x.type === 'song'))}
                        className="flex flex-col gap-2 w-36 flex-shrink-0"
                      >
                        <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-colored relative">
                          {getSongImage(item) ? <img src={getSongImage(item)} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-2 flex items-center justify-center"><Music2 size={32} className="text-muted" /></div>}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Play size={32} fill="white" className="text-white" />
                          </div>
                        </div>
                        <div className="text-left pr-2">
                          <p className="text-text text-sm font-bold line-clamp-1">{item.name}</p>
                          <p className="text-muted text-[11px] line-clamp-1">{getArtistsText(item)}</p>
                        </div>
                      </motion.button>
                    );
                  }
                  return <AlbumSquare key={item.id} item={item} onClick={() => navigate(`/${item.type || 'album'}/${item.id}`)} />;
                })}
              </div>
            </div>
          ))
        )}

        {/* Top Songs Fallback (Trending) */}
        {!loading && topSongs.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between px-5 mb-4">
              <h2 className="text-text font-bold text-lg">Top Songs</h2>
              <button className="text-primary-soft text-xs font-bold" onClick={() => navigate('/search')}>Show all</button>
            </div>
            <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-4">
              {topSongs.map((song) => (
                <motion.button
                  key={song.id || song.saavnId} whileTap={{ scale: 0.95 }}
                  onClick={() => handlePlay(song, topSongs)}
                  className="flex flex-col gap-2 w-32 flex-shrink-0"
                >
                  <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-md relative group">
                    <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left pr-1">
                    <p className="text-text text-xs font-bold line-clamp-1">{song.name}</p>
                    <p className="text-muted text-[10px] line-clamp-1">{getArtistsText(song)}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}
        <div className="h-6" />
      </div>
      <MiniPlayer />
    </div>
  );
}
