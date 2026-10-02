import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { playlists } from '@/api/endpoints';
import { Plus, Heart, Download, Music2, Users, ChevronRight, Play } from 'lucide-react';
import { SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong, getArtistsText } from '@/utils/song';
import { getSongImage } from '@/utils/image';
import { usePlayerStore } from '@/store/player';
import { useUIStore } from '@/store/ui';
import { getDownloadedSongs, type OfflineSong } from '@/utils/offline';
import SongRow from '@/components/SongRow';
import { listStaggerVariants, fadeVariants } from '@/motion';

const LIBRARY_TABS = [
  { label: 'Playlists', icon: Music2 },
  { label: 'Liked',     icon: Heart  },
  { label: 'Downloads', icon: Download },
  { label: 'Artists',   icon: Users  },
];

function LikedTab() {
  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['likedTracks'],
    queryFn: playlists.likedTracks,
    staleTime: 5 * 60 * 1000,
  });
  
  const setQueue = usePlayerStore((s) => s.setQueue);
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  const liked = data?.tracks || [];

  const handlePlay = (startIndex = 0) => {
    if (!liked.length) return;
    setQueue(liked.map((s: any) => formatPlayerSong(s)), startIndex);
  };

  const handleUnlike = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const previous = queryClient.getQueryData(['likedTracks']) as any;
    queryClient.setQueryData(['likedTracks'], (old: any) => ({
      ...old,
      tracks: old?.tracks?.filter((s: any) => (s.songId || s.id || s.saavnId) !== songId) || []
    }));
    try {
      await playlists.like(songId, false);
    } catch {
      queryClient.setQueryData(['likedTracks'], previous);
      addToast('Failed to unlike song', 'error');
    }
  };

  if (loading) return <div className="px-4">{Array.from({ length: 5 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>;
  if (isError) return (
    <div className="flex flex-col items-center py-16 px-4">
      <Heart size={48} className="text-danger mb-4 opacity-40" />
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Couldn't load liked songs</p>
    </div>
  );
  if (!liked.length) return (
    <div className="flex flex-col items-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,61,142,0.12)' }}>
        <Heart size={36} style={{ color: 'var(--color-accent)' }} />
      </div>
      <p className="font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>No liked songs yet</p>
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Tap ♡ on any song to save it here</p>
    </div>
  );

  return (
    <>
      <div className="flex gap-3 px-5 mb-4 mt-2">
        <button onClick={() => handlePlay(0)}
          className="flex-1 text-white font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', boxShadow: '0 8px 24px rgba(139,61,255,0.3)' }}>
          <Play size={18} fill="white" />Play All ({liked.length})
        </button>
      </div>
      {liked.map((song: any, i: number) => (
        <motion.div
          key={song.songId || song.id || song.saavnId}
          custom={i}
          variants={listStaggerVariants}
          initial="initial"
          animate="animate"
          className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 rounded-xl mx-2"
        >
          <button onClick={() => handlePlay(i)} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--color-surface-2)' }}>
              {getSongImage(song) && <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>{song.name}</p>
              <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-muted)' }}>{getArtistsText(song)}</p>
            </div>
          </button>
          <button onClick={(e) => handleUnlike(song.songId || song.id || song.saavnId, e)} className="p-2 flex-shrink-0" aria-label="Unlike">
            <Heart size={18} fill="var(--color-accent)" style={{ color: 'var(--color-accent)' }} />
          </button>
        </motion.div>
      ))}
    </>
  );
}

function DownloadsTab() {
  const [downloads, setDownloads] = useState<OfflineSong[]>([]);
  const [loading, setLoading] = useState(true);
  const setQueue = usePlayerStore((s) => s.setQueue);

  useEffect(() => {
    getDownloadedSongs().then((list) => { setDownloads(list); setLoading(false); });
  }, []);

  const handlePlay = (startIndex = 0) => {
    if (!downloads.length) return;
    setQueue(downloads.map((s) => ({
      id: s.id, name: s.name, artist: s.artist,
      image: s.image, durationMs: s.durationMs, streamUrl: s.streamUrl,
    })), startIndex);
  };

  if (loading) return <div className="px-4">{Array.from({ length: 3 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>;
  if (!downloads.length) return (
    <div className="flex flex-col items-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(139,61,255,0.12)' }}>
        <Download size={36} style={{ color: 'var(--color-primary-soft)' }} />
      </div>
      <p className="font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>No downloads yet</p>
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Downloaded songs appear here for offline listening</p>
    </div>
  );

  return (
    <>
      <div className="flex gap-3 px-5 mb-4 mt-2">
        <button onClick={() => handlePlay(0)}
          className="flex-1 text-white font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-soft))', boxShadow: '0 8px 24px rgba(139,61,255,0.3)' }}>
          <Play size={18} fill="white" />Play Offline Queue
        </button>
      </div>
      <div className="flex flex-col gap-1 px-4">
        {downloads.map((song, i) => (
          <SongRow key={song.id} song={song} onPlay={() => handlePlay(i)} />
        ))}
      </div>
    </>
  );
}

export default function Library() {
  const location = useLocation();
  const initialTab = (location.state as any)?.tab === 'downloads' || !navigator.onLine ? 2 : 0;
  const [activeTab, setActiveTab] = useState(initialTab);
  const navigate = useNavigate();

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['playlists', 'user'],
    queryFn: playlists.list,
    staleTime: 5 * 60 * 1000,
  });
  const { data: sysData, isLoading: sysLoading } = useQuery({
    queryKey: ['playlists', 'system'],
    queryFn: playlists.system,
    staleTime: 5 * 60 * 1000,
  });

  const userPlaylists = Array.isArray(userData) ? userData : (userData?.items || []);
  const systemPlaylists = Array.isArray(sysData) ? sysData : (sysData?.items || []);
  const loading = userLoading || sysLoading;

  const createPlaylist = async () => {
    try {
      const res = await playlists.create({});
      navigate(`/playlist/${res._id || res.id}`);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="px-5 flex-shrink-0" style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)`, paddingBottom: 12 }}>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>Library</h1>
          {activeTab === 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={createPlaylist}
              aria-label="Create playlist"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(139,61,255,0.15)', border: '1px solid rgba(139,61,255,0.3)' }}
            >
              <Plus size={18} style={{ color: 'var(--color-primary-soft)' }} />
            </motion.button>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 overflow-x-auto scroll-x">
          {LIBRARY_TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = i === activeTab;
            return (
              <motion.button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-xs font-bold transition-all"
                style={
                  isActive
                    ? { background: 'var(--color-primary)', color: 'white' }
                    : { background: 'rgba(27,24,54,0.8)', color: 'var(--color-muted)', border: '1px solid rgba(40,36,77,0.7)' }
                }
              >
                <Icon size={13} />
                {tab.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            {/* Playlists */}
            {activeTab === 0 && (
              <>
                {loading && Array.from({ length: 5 }).map((_, i) => <SongRowSkeleton key={i} />)}
                {!loading && (
                  <>
                    {[...systemPlaylists, ...userPlaylists.filter((pl: any) => !pl.isSystem)].map((pl: any, i: number) => (
                      <motion.button
                        key={pl.id || pl._id}
                        custom={i}
                        variants={listStaggerVariants}
                        initial="initial"
                        animate="animate"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate(`/playlist/${pl.id || pl._id}`)}
                        className="flex items-center gap-4 px-5 py-3 w-full hover:bg-white/5 rounded-xl mx-0"
                      >
                        <div className="w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden"
                          style={{ background: pl.isSystem ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' : 'var(--color-surface-2)' }}>
                          {pl.isSystem
                            ? <Heart size={24} fill="white" className="text-white absolute inset-0 m-auto" style={{ position: 'relative', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                            : (pl.coverImageUrl || pl.artwork)
                              ? <img src={pl.coverImageUrl || pl.artwork} alt={pl.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Music2 size={24} style={{ color: 'var(--color-muted)' }} /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-semibold line-clamp-1 text-sm" style={{ color: 'var(--color-text)' }}>{pl.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                            {pl.trackCount || 0} songs · {pl.isSystem ? 'System' : pl.visibility === 'public' ? 'Public' : 'Private'}
                          </p>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--color-muted)' }} />
                      </motion.button>
                    ))}
                    {userPlaylists.length === 0 && systemPlaylists.length === 0 && (
                      <div className="flex flex-col items-center py-16 px-4 text-center">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(139,61,255,0.12)' }}>
                          <Music2 size={36} style={{ color: 'var(--color-primary-soft)' }} />
                        </div>
                        <p className="font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>No playlists yet</p>
                        <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>Create your first playlist to get started</p>
                        <button onClick={createPlaylist}
                          className="px-6 py-3 rounded-2xl text-white text-sm font-bold"
                          style={{ background: 'var(--color-primary)' }}>
                          Create Playlist
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {activeTab === 1 && <LikedTab />}
            {activeTab === 2 && <DownloadsTab />}
            {activeTab === 3 && (
              <div className="flex flex-col items-center py-16 px-4 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(45,225,181,0.12)' }}>
                  <Users size={36} style={{ color: 'var(--color-mint)' }} />
                </div>
                <p className="font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>Artists coming soon</p>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Followed artists will appear here</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
