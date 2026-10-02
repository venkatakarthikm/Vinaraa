import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowUpDown, LayoutGrid, List, Heart, Sparkles, Repeat, Clock, RefreshCw, Download, Music2 } from 'lucide-react';
import { playlists } from '@/api/endpoints';
import Page from '@/components/Page';
import Chip from '@/components/Chip';
import SongRow from '@/components/SongRow';
import { MediaCard, ArtistCircle } from '@/components/MediaCard';
import { ControlStrip } from '@/components/ControlStrip';
import { usePrefsStore } from '@/store/prefs';
import { useUIStore } from '@/store/ui';
import { getDownloadedSongs } from '@/utils/offline';
import type { OfflineSong } from '@/utils/offline';
import { formatPlayerSong } from '@/utils/song';
import { usePlayerStore } from '@/store/player';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { Sheet } from '@/components/SheetHost';

type LibraryTab = 'playlists' | 'liked' | 'downloads' | 'artists';

export default function Library() {
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToast = useUIStore((s) => s.addToast);
  const { libraryView, setLibraryView } = usePrefsStore();

  const [activeTab, setActiveTab] = useState<LibraryTab>('playlists');
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [likedTracks, setLikedTracks] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<OfflineSong[]>([]);
  const [followedArtists, setFollowedArtists] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadLibraryData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'playlists') {
        const res = await playlists.list();
        setUserPlaylists(Array.isArray(res) ? res : res?.items || []);
      } else if (activeTab === 'liked') {
        const res = await playlists.likedTracks();
        setLikedTracks(res?.tracks || []);
      } else if (activeTab === 'downloads') {
        const list = await getDownloadedSongs();
        setDownloads(list);
      } else if (activeTab === 'artists') {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('following:'));
        const artists = keys.map((k) => {
          const id = k.replace('following:', '');
          return { id, name: `Artist ${id}` };
        });
        setFollowedArtists(artists);
      }
    } catch (_e) {
      // Offline or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibraryData();
  }, [activeTab]);

  const handleCreatePlaylist = async () => {
    try {
      const res = await playlists.create({ name: newPlaylistName.trim() || undefined });
      addToast(`Created playlist ${res.name || 'New Playlist'}`, 'success');
      setCreateDialogOpen(false);
      setNewPlaylistName('');
      navigate(`/playlist/${res.id || res._id}`);
    } catch (_e) {
      addToast('Failed to create playlist', 'error');
    }
  };

  const tabs: LibraryTab[] = ['playlists', 'liked', 'downloads', 'artists'];

  const systemPlaylists = [
    { id: 'liked', name: 'Liked Songs', subtitle: 'System · Favorite songs', icon: Heart, color: 'from-rose-500 to-pink-600' },
    { id: 'taste-mix', name: 'Your Taste Mix', subtitle: 'System · Tuned for you', icon: Sparkles, color: 'from-purple-500 to-indigo-600' },
    { id: 'on-repeat', name: 'On Repeat', subtitle: 'System · Most played', icon: Repeat, color: 'from-emerald-500 to-teal-600' },
    { id: 'recently-added', name: 'Recently Added', subtitle: 'System · Latest additions', icon: Clock, color: 'from-amber-500 to-orange-600' },
  ];

  return (
    <Page
      title="Library"
      isTabRoot
      headerActions={
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
          aria-label="New playlist"
        >
          <Plus size={20} />
        </button>
      }
    >
      <div className="flex flex-col gap-6 px-5 pt-2 pb-[120px]">
        {/* Control Strip Slot */}
        <ControlStrip>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 mr-2">
              {tabs.map((tab) => (
                <Chip
                  key={tab}
                  label={tab.charAt(0).toUpperCase() + tab.slice(1)}
                  selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                />
              ))}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setLibraryView(libraryView === 'list' ? 'grid' : 'list')}
                className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="Toggle view"
              >
                {libraryView === 'list' ? <LayoutGrid size={18} /> : <List size={18} />}
              </button>
              <button
                className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="Sort"
              >
                <ArrowUpDown size={18} />
              </button>
            </div>
          </div>
        </ControlStrip>

        {/* TAB 1: PLAYLISTS */}
        {activeTab === 'playlists' && (
          <div className="flex flex-col gap-6">
            {/* Pinned System Playlists */}
            <section className="flex flex-col gap-2">
              <h3 className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
                System
              </h3>
              <div className="flex flex-col gap-1">
                {systemPlaylists.map((sys) => {
                  const Icon = sys.icon;
                  return (
                    <div
                      key={sys.id}
                      onClick={() => navigate(`/playlist/${sys.id}`)}
                      className="w-full h-[64px] px-3 rounded-[16px] hover:bg-surface-2 flex items-center gap-3 cursor-pointer transition-colors"
                    >
                      <div className={`w-[56px] h-[56px] rounded-[16px] bg-gradient-to-br ${sys.color} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                        <Icon size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="t-h3 text-[16px] font-bold text-text truncate">{sys.name}</h3>
                        <p className="t-cap text-[12px] text-muted truncate">{sys.subtitle}</p>
                      </div>
                      {(sys.id === 'taste-mix' || sys.id === 'on-repeat') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToast('Mix refreshed', 'success');
                          }}
                          className="p-2 text-muted hover:text-text"
                          aria-label="Refresh mix"
                        >
                          <RefreshCw size={18} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* User Playlists */}
            <section className="flex flex-col gap-3">
              <h3 className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
                Your playlists
              </h3>

              {loading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-[64px] rounded-[16px] bg-surface-2 animate-pulse" />
                  ))}
                </div>
              ) : userPlaylists.length > 0 ? (
                libraryView === 'list' ? (
                  <div className="flex flex-col gap-1">
                    {userPlaylists.map((pl) => (
                      <div
                        key={pl.id || pl._id}
                        onClick={() => navigate(`/playlist/${pl.id || pl._id}`)}
                        className="w-full h-[64px] px-3 rounded-[16px] hover:bg-surface-2 flex items-center gap-3 cursor-pointer transition-colors"
                      >
                        <div className="w-[56px] h-[56px] rounded-[16px] overflow-hidden bg-surface-2 flex items-center justify-center text-muted flex-shrink-0">
                          {pl.artwork ? (
                            <img src={pl.artwork} alt={pl.name} className="w-full h-full object-cover" />
                          ) : (
                            <Music2 size={24} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="t-h3 text-[16px] font-bold text-text truncate">{pl.name}</h3>
                          <p className="t-cap text-[12px] text-muted truncate">
                            {pl.trackCount || 0} songs
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {userPlaylists.map((pl) => (
                      <MediaCard
                        key={pl.id || pl._id}
                        id={pl.id || pl._id}
                        title={pl.name}
                        subtitle={`${pl.trackCount || 0} songs`}
                        image={pl.artwork}
                        type="playlist"
                        width="100%"
                        onClick={() => navigate(`/playlist/${pl.id || pl._id}`)}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="py-12 flex flex-col items-center text-center gap-3">
                  <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
                    <Music2 size={32} />
                  </div>
                  <h2 className="t-h2 text-[20px] font-bold text-text">No playlists yet</h2>
                  <p className="t-cap text-[13px] text-muted">
                    Save songs to start your collection.
                  </p>
                  <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="mt-2">
                    Create playlist
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: LIKED */}
        {activeTab === 'liked' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="t-cap text-[13px] font-semibold text-muted">
                {likedTracks.length} liked songs
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (likedTracks.length) {
                      setQueue(likedTracks.map(formatPlayerSong), 0);
                      navigate('/player');
                    }
                  }}
                >
                  Play
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-[64px] rounded-[16px] bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : likedTracks.length > 0 ? (
              <div className="flex flex-col divide-y divide-line/20">
                {likedTracks.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    onPlay={() => {
                      setQueue([formatPlayerSong(song)], 0);
                      navigate('/player');
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-heart">
                  <Heart size={32} />
                </div>
                <h2 className="t-h2 text-[20px] font-bold text-text">No liked songs yet</h2>
                <p className="t-cap text-[13px] text-muted">Tap the heart on any song.</p>
                <Button size="sm" onClick={() => navigate('/home')} className="mt-2">
                  Browse music
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DOWNLOADS */}
        {activeTab === 'downloads' && (
          <div className="flex flex-col gap-4">
            {downloads.length > 0 ? (
              <div className="flex flex-col divide-y divide-line/20">
                {downloads.map((song) => (
                  <SongRow
                    key={song.id}
                    song={{
                      id: song.id,
                      name: song.name,
                      artist: song.artist,
                      image: song.image,
                      durationMs: song.durationMs,
                      streamUrl: song.streamUrl,
                    }}
                    isDownloaded
                    onPlay={() => {
                      setQueue(
                        [
                          {
                            id: song.id,
                            name: song.name,
                            artist: song.artist,
                            image: song.image,
                            durationMs: song.durationMs,
                            streamUrl: song.streamUrl,
                          },
                        ],
                        0
                      );
                      navigate('/player');
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
                  <Download size={32} />
                </div>
                <h2 className="t-h2 text-[20px] font-bold text-text">Nothing downloaded yet</h2>
                <p className="t-cap text-[13px] text-muted">
                  Download songs to listen without internet.
                </p>
                <Button size="sm" onClick={() => navigate('/home')} className="mt-2">
                  Browse music
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ARTISTS */}
        {activeTab === 'artists' && (
          <div className="flex flex-col gap-4">
            {followedArtists.length > 0 ? (
              <div className="grid grid-cols-2 gap-y-6 justify-items-center">
                {followedArtists.map((artist) => (
                  <ArtistCircle
                    key={artist.id}
                    id={artist.id}
                    name={artist.name}
                    size={96}
                    onClick={() => navigate(`/artist/${artist.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
                  <Music2 size={32} />
                </div>
                <h2 className="t-h2 text-[20px] font-bold text-text">No followed artists</h2>
                <p className="t-cap text-[13px] text-muted">
                  Follow artists to see them here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Playlist Sheet */}
      <Sheet
        id="create-playlist-sheet"
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title="New playlist"
      >
        <div className="flex flex-col gap-4 py-2">
          <Input
            label="Playlist name"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="e.g. My Favorites"
          />
          <Button size="lg" onClick={handleCreatePlaylist} className="w-full mt-2">
            Create
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
