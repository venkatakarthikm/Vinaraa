import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { playlists } from '@/api/endpoints';
import { Plus, Heart, Download, Music2, Users, ChevronRight, Play } from 'lucide-react';
import { SongRowSkeleton } from '@/components/Skeleton';
import MiniPlayer from '@/components/MiniPlayer';
import { formatPlayerSong, getArtistsText } from '@/utils/song';
import { getSongImage } from '@/utils/image';
import { usePlayerStore } from '@/store/player';
import { useUIStore } from '@/store/ui';

const LIBRARY_TABS = ['Playlists', 'Liked', 'Downloads', 'Artists'];

function LikedTab() {
  const [liked, setLiked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setShowPlayer = usePlayerStore((s) => s.setShowPlayer);
  const navigate = useNavigate();
  const { addToast } = useUIStore();

  useEffect(() => {
    playlists.likedTracks()
      .then((res) => {
        setLiked(res?.tracks || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load liked songs');
        setLoading(false);
      });
  }, []);

  const handlePlay = (startIndex = 0) => {
    if (!liked.length) return;
    const songs = liked.map((s: any) => formatPlayerSong(s));
    setQueue(songs, startIndex);
    setShowPlayer(true);
    navigate('/player');
  };

  const handleUnlike = async (songId: string, e: any) => {
    e.stopPropagation();
    const previous = [...liked];
    setLiked((l) => l.filter((s) => (s.songId || s.id || s.saavnId) !== songId));
    try {
      await playlists.like(songId, false);
    } catch {
      setLiked(previous);
      addToast('Failed to unlike song', 'error');
    }
  };

  if (loading) return <div>{Array.from({ length: 5 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>;
  if (error) return <div className="text-center py-12 text-danger">{error}</div>;
  if (!liked.length) return (
    <div className="text-center py-12 px-4">
      <Heart size={40} className="text-accent mx-auto mb-3" />
      <p className="text-muted">Tap ♡ on any song to save it here.</p>
    </div>
  );

  return (
    <>
      <div className="flex gap-3 px-5 mb-5 mt-2">
        <button onClick={() => handlePlay(0)}
          className="flex-1 bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-3 flex items-center justify-center gap-2 shadow-colored">
          <Play size={18} fill="white" />Play
        </button>
      </div>
      {liked.map((song, i) => (
        <div key={song.songId || song.id || song.saavnId} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/30">
          <button onClick={() => handlePlay(i)} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
              {getSongImage(song) && <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-text text-sm font-semibold line-clamp-1">{song.name}</p>
              <p className="text-muted text-xs line-clamp-1">{getArtistsText(song)}</p>
            </div>
          </button>
          <button onClick={(e) => handleUnlike(song.songId || song.id || song.saavnId, e)} className="p-2 text-text flex-shrink-0" aria-label="Unlike">
            <Heart size={20} fill="#FF3D8E" className="text-[#FF3D8E]" />
          </button>
        </div>
      ))}
    </>
  );
}

export default function Library() {
  const [activeTab, setActiveTab] = useState(0);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [systemPlaylists, setSystemPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([playlists.list(), playlists.system()]).then(([user, sys]) => {
      if (user.status === 'fulfilled') setUserPlaylists(Array.isArray(user.value) ? user.value : (user.value?.items || []));
      if (sys.status === 'fulfilled') setSystemPlaylists(Array.isArray(sys.value) ? sys.value : (sys.value?.items || []));
      setLoading(false);
    });
  }, []);

  const createPlaylist = async () => {
    try {
      const res = await playlists.create({});
      navigate(`/playlist/${res._id || res.id}`);
    } catch (_e) {}
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-text">Library</h1>
          {activeTab === 0 && (
            <button onClick={createPlaylist} aria-label="Create playlist"
              className="bg-primary/20 border border-primary/40 rounded-full p-2">
              <Plus size={20} className="text-primary-soft" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto scroll-x pb-1">
          {LIBRARY_TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-semibold transition-all ${i === activeTab ? 'bg-primary text-white' : 'bg-surface-2 text-muted border border-border'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        {loading && Array.from({ length: 5 }).map((_, i) => <SongRowSkeleton key={i} />)}
        {!loading && activeTab === 0 && (
          <>
            {systemPlaylists.map((pl) => (
              <button key={pl.id || pl._id} onClick={() => navigate(`/playlist/${pl.id || pl._id}`)}
                className="flex items-center gap-4 px-5 py-3 w-full hover:bg-surface-2/30">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                  <Heart size={24} fill="white" className="text-white" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-text font-semibold line-clamp-1">{pl.name}</p>
                  <p className="text-muted text-xs">{pl.trackCount || 0} songs · System</p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>
            ))}
            {userPlaylists.filter((pl) => !pl.isSystem).map((pl) => (
              <button key={pl.id || pl._id} onClick={() => navigate(`/playlist/${pl.id || pl._id}`)}
                className="flex items-center gap-4 px-5 py-3 w-full hover:bg-surface-2/30">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {pl.coverImageUrl || pl.artwork ? <img src={pl.coverImageUrl || pl.artwork} alt={pl.name} className="w-full h-full object-cover" />
                    : <Music2 size={24} className="text-muted" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-text font-semibold line-clamp-1">{pl.name}</p>
                  <p className="text-muted text-xs">{pl.trackCount || 0} songs · {pl.visibility === 'public' ? 'Public' : 'Private'}</p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>
            ))}
            {userPlaylists.length === 0 && systemPlaylists.length === 0 && (
              <div className="text-center py-12 px-4">
                <Music2 size={40} className="text-muted mx-auto mb-3" />
                <p className="text-muted">No playlists yet.</p>
                <button onClick={createPlaylist} className="mt-4 bg-primary text-white px-6 py-3 rounded-pill font-semibold text-sm">
                  Create Playlist
                </button>
              </div>
            )}
          </>
        )}
        {!loading && activeTab === 1 && (
          <LikedTab />
        )}
        {!loading && activeTab === 2 && (
          <div className="text-center py-12 px-4">
            <Download size={40} className="text-primary-soft mx-auto mb-3" />
            <p className="text-muted">Downloaded songs appear here.</p>
          </div>
        )}
        {!loading && activeTab === 3 && (
          <div className="text-center py-12 px-4">
            <Users size={40} className="text-mint mx-auto mb-3" />
            <p className="text-muted">Followed artists appear here.</p>
          </div>
        )}
      </div>
      <MiniPlayer />
    </div>
  );
}
