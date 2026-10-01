import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { listStaggerVariants } from '@/motion';
import { recommendations, music } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useNavigate } from 'react-router-dom';
import { CardSkeleton } from '@/components/Skeleton';
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
  subtitle?: string;
  items: any[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function HeroPick({ song, onPlay, contextQueue }: { song: any; onPlay: (s: any, q: any[]) => void; contextQueue: any[] }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onPlay(song, contextQueue)}
      className="w-full relative h-64 rounded-3xl overflow-hidden shadow-2xl mb-8 group"
    >
      {getSongImage(song) ? (
        <img src={getSongImage(song)} alt={song.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      ) : (
        <div className="absolute inset-0 bg-surface-2 flex items-center justify-center"><Music2 size={48} className="text-muted" /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-primary/20 mix-blend-overlay" />
      
      <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
        <div className="text-left flex-1 min-w-0 pr-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/10 mb-3">
            <Sparkles size={12} className="text-white" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Top Pick For You</span>
          </div>
          <h2 className="text-3xl font-black text-white truncate drop-shadow-lg mb-1">{song.name}</h2>
          <p className="text-white/80 text-sm font-medium truncate">{getArtistsText(song)}</p>
        </div>
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--color-primary),0.5)] transform group-hover:scale-110 transition-transform flex-shrink-0">
          <Play size={24} fill="white" className="text-white ml-1" />
        </div>
      </div>
    </motion.button>
  );
}

function QuickPickCard({ song, onPlay, index, contextQueue }: { song: any; onPlay: (s: any, q: any[]) => void; index: number, contextQueue: any[] }) {
  return (
    <motion.button
      custom={index} variants={listStaggerVariants} initial="initial" animate="animate"
      whileTap={{ scale: 0.95 }}
      onClick={() => onPlay(song, contextQueue)}
      className="flex items-center gap-3 bg-surface-2/40 hover:bg-surface-2 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm border border-white/5 transition-colors group"
    >
      <div className="w-16 h-16 bg-surface flex-shrink-0 relative">
        {getSongImage(song) ? <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 size={20} className="text-muted" /></div>}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play size={20} fill="white" className="text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0 pr-3 text-left py-2">
        <p className="text-text text-sm font-bold line-clamp-1 mb-0.5">{song.name}</p>
        <p className="text-muted text-[11px] line-clamp-1">{getArtistsText(song)}</p>
      </div>
    </motion.button>
  );
}

function ArtistCircle({ item, onClick }: { item: any, onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }} onClick={onClick}
      className="flex flex-col items-center gap-3 w-24 flex-shrink-0 group"
    >
      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-transparent group-hover:border-primary/50 shadow-lg relative transition-colors">
        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-surface-2 flex items-center justify-center"><Mic2 size={24} className="text-muted" /></div>}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-text text-xs font-bold line-clamp-1 text-center w-full">{item.name}</p>
    </motion.button>
  );
}

function AlbumSquare({ item, onClick }: { item: any, onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }} onClick={onClick}
      className="flex flex-col gap-3 w-36 flex-shrink-0 group"
    >
      <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-md relative">
        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full bg-surface-2 flex items-center justify-center"><Film size={32} className="text-muted" /></div>}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="text-left px-1">
        <p className="text-text text-sm font-bold line-clamp-1 mb-0.5">{item.name}</p>
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
        music.trending('telugu'),
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

  // Curated prominent entities for Telugu & Global Music Lovers
  const FEATURED_PLAYLISTS = [
    { id: '2574962', name: 'Adhire Hits', type: 'playlist', subtitle: 'Telugu Blockbuster Hits', image: 'https://c.saavncdn.com/editorial/AdhireHits_20230323062000_500x500.jpg' },
    { id: '1134643225', name: 'Telugu Superhits', type: 'playlist', subtitle: 'Top 50 Telugu Tracks', image: 'https://c.saavncdn.com/editorial/IndiaSuperhitsTop50Telugu_20230323062111_500x500.jpg' },
    { id: '47599074', name: 'Now Trending', type: 'playlist', subtitle: 'Viral Chartbusters', image: 'https://c.saavncdn.com/editorial/NowTrending_20260423085344.jpg' },
    { id: '110858205', name: 'Trending Today', type: 'playlist', subtitle: 'Today’s Hot Pick', image: 'https://c.saavncdn.com/editorial/TrendingToday_20230323062222_500x500.jpg' },
  ];

  const MUSIC_DIRECTORS = [
    { id: '455663', name: 'Anirudh', image: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_004_20230323061611_500x500.jpg' },
    { id: '455130', name: 'Thaman S', image: 'https://c.saavncdn.com/artists/S._Thaman_002_20231019124439_500x500.jpg' },
    { id: '456070', name: 'DSP', image: 'https://c.saavncdn.com/artists/Devi_Sri_Prasad_002_20230807185012_500x500.jpg' },
    { id: '459320', name: 'A.R. Rahman', image: 'https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg' },
    { id: '455115', name: 'M.M. Keeravaani', image: 'https://c.saavncdn.com/artists/M_M_Keeravaani_002_20230323061239_500x500.jpg' },
  ];

  const MOVIES = [
    { id: '58371014', name: 'Devara', type: 'album', image: 'https://c.saavncdn.com/313/Devara-Part-1-Telugu-Telugu-2024-20240926171010-500x500.jpg' },
    { id: '53183578', name: 'Pushpa 2', type: 'album', image: 'https://c.saavncdn.com/004/Pushpa-2-The-Rule-Telugu-2024-20240528191024-500x500.jpg' },
    { id: '50314488', name: 'Salaar', type: 'album', image: 'https://c.saavncdn.com/495/Salaar-Telugu-Telugu-2023-20231222161201-500x500.jpg' },
    { id: '49454178', name: 'Leo', type: 'album', image: 'https://c.saavncdn.com/791/Leo-Telugu-Telugu-2023-20231019044810-500x500.jpg' },
  ];

  const uniqueTrending = trending.filter((v, i, a) => a.findIndex(t => (t.id || t.saavnId || t._id) === (v.id || v.saavnId || v._id) || uniqName(t) === uniqName(v)) === i);
  const heroPick = uniqueTrending[0];
  const quickPicks = uniqueTrending.slice(1, 7);

  return (
    <div className="flex flex-col h-full bg-bg overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-primary/15 via-primary/5 to-bg z-0 pointer-events-none" />
      
      <div className="flex-1 scroll-y overflow-y-auto pb-24 z-10">
        <div className="flex items-center justify-between px-5 pt-10 pb-6 sticky top-0 z-20 bg-gradient-to-b from-bg/90 to-bg/0 backdrop-blur-md">
          <div>
            <p className="text-muted text-[13px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
               {getGreeting()}
            </p>
            <h1 className="text-3xl font-black text-text tracking-tight">{user?.name?.split(' ')[0] || 'Music Lover'}</h1>
          </div>
          <div className="flex gap-3">
            <button className="w-10 h-10 rounded-full bg-surface-2/60 backdrop-blur-md border border-white/5 shadow-sm flex items-center justify-center hover:bg-surface-2 transition-colors">
              <Bell size={20} className="text-text" />
            </button>
            <button onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-colored border-2 border-bg hover:scale-105 transition-transform"
              aria-label="Profile">
              <span className="text-white font-black text-sm">{(user?.name || 'U')[0].toUpperCase()}</span>
            </button>
          </div>
        </div>

        <div className="px-5">
          {loading ? (
            <div className="shimmer h-64 rounded-3xl mb-8" />
          ) : heroPick && (
            <HeroPick song={heroPick} onPlay={handlePlay} contextQueue={uniqueTrending} />
          )}
        </div>

        {/* Quick Picks */}
        {!loading && quickPicks.length > 0 && (
          <div className="px-5 mb-10">
            <h2 className="text-text font-black text-xl mb-4">Jump Back In</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickPicks.map((song, i) => (
                <QuickPickCard key={song.id || song.saavnId} song={song} onPlay={handlePlay} index={i} contextQueue={quickPicks} />
              ))}
            </div>
          </div>
        )}

        {/* Featured Playlists */}
        <div className="mb-10">
          <div className="flex items-center justify-between px-5 mb-4">
            <h2 className="text-text font-black text-xl">Hot Playlists</h2>
            <ChevronRight size={22} className="text-muted" />
          </div>
          <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-4">
            {FEATURED_PLAYLISTS.map((pl) => (
              <AlbumSquare key={pl.id} item={pl} onClick={() => navigate(`/playlist/${pl.id}`)} />
            ))}
          </div>
        </div>

        {/* Music Directors */}
        <div className="mb-10">
          <div className="flex items-center justify-between px-5 mb-4">
            <h2 className="text-text font-black text-xl">Top Directors</h2>
            <ChevronRight size={22} className="text-muted" />
          </div>
          <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-4">
            {MUSIC_DIRECTORS.map((artist) => (
              <ArtistCircle key={artist.id} item={artist} onClick={() => navigate(`/artist/${artist.id}`)} />
            ))}
          </div>
        </div>
        
        {/* Top Movies */}
        <div className="mb-10">
          <div className="flex items-center justify-between px-5 mb-4">
            <h2 className="text-text font-black text-xl">Trending Movies</h2>
            <ChevronRight size={22} className="text-muted" />
          </div>
          <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-4">
            {MOVIES.map((movie) => (
              <AlbumSquare key={movie.id} item={movie} onClick={() => navigate(`/album/${movie.id}`)} />
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
            <div key={rail.key || rail.id} className="mb-10">
              <div className="flex items-center justify-between px-5 mb-4">
                <div>
                  <h2 className="text-text font-black text-xl">{rail.title}</h2>
                  {rail.subtitle && <p className="text-muted text-xs font-medium mt-1 max-w-[85%]">{rail.subtitle}</p>}
                </div>
              </div>
              <div className="flex gap-4 px-5 overflow-x-auto scroll-x pb-4">
                {rail.items.slice(0, 10).map((item: any) => {
                  if (item.type === 'song') {
                    return (
                      <motion.button
                        key={item.id} whileTap={{ scale: 0.95 }}
                        onClick={() => handlePlay(item, rail.items.filter((x: any) => x.type === 'song'))}
                        className="flex flex-col gap-3 w-36 flex-shrink-0 group"
                      >
                        <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-md relative">
                          {getSongImage(item) ? <img src={getSongImage(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full bg-surface-2 flex items-center justify-center"><Music2 size={32} className="text-muted" /></div>}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play size={32} fill="white" className="text-white" />
                          </div>
                        </div>
                        <div className="text-left px-1">
                          <p className="text-text text-sm font-bold line-clamp-1 mb-0.5">{item.name}</p>
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
        <div className="h-6" />
      </div>
      <MiniPlayer />
    </div>
  );
}
