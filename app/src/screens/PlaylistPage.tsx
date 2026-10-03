import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Shuffle, Download, ArrowUpDown, EllipsisVertical, ListMusic, Lock, Globe, Link as LinkIcon, Plus } from 'lucide-react';
import { playlists, music } from '@/api/endpoints';
import Page from '@/components/Page';
import SongRow from '@/components/SongRow';
import { ControlStrip } from '@/components/ControlStrip';
import { Skeleton, SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import { usePlayerStore } from '@/store/player';
import { useUIStore } from '@/store/ui';
import Button from '@/components/Button';

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToast = useUIStore((s) => s.addToast);

  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    playlists.get(id)
      .then((d) => {
        if (d && (d.tracks?.length || d.songs?.length)) {
          setPlaylist(d);
        } else {
          return music.editorialPlaylist(id);
        }
      })
      .then((edRes) => {
        if (edRes) setPlaylist(edRes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const songs = (playlist?.tracks || playlist?.songs || []).map(formatPlayerSong);

  const handlePlayAll = (startIndex = 0) => {
    if (songs.length) {
      setQueue(songs, startIndex, 'playlist', playlist?.id, playlist?.name);
      navigate('/player');
    }
  };

  const handleRemoveTrack = async (songId: string) => {
    if (!id) return;
    try {
      await playlists.removeTrack(id, { songIds: [songId] });
      setPlaylist((prev: any) => ({
        ...prev,
        tracks: (prev.tracks || prev.songs || []).filter((s: any) => (s.id || s.songId) !== songId),
      }));
      addToast('Removed from playlist', 'info');
    } catch (_e) {
      addToast('Failed to remove song', 'error');
    }
  };

  return (
    <Page>
      <div className="flex flex-col gap-6 pb-[120px]">
        {/* Control Strip Slot */}
        <ControlStrip>
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => handlePlayAll(0)}
              className="h-[40px] px-5 rounded-full bg-primary text-on-primary flex items-center gap-2 t-cap text-[13px] font-bold shadow-md active:scale-95 transition-transform"
            >
              <Play size={18} fill="currentColor" />
              <span>Play</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlayAll(Math.floor(Math.random() * songs.length))}
                className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="Shuffle"
              >
                <Shuffle size={18} />
              </button>
              <button
                onClick={() => addToast('Download started', 'info')}
                className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="Download"
              >
                <Download size={18} />
              </button>
              <button
                className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="Sort"
              >
                <ArrowUpDown size={18} />
              </button>
              <button
                className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="More options"
              >
                <EllipsisVertical size={18} />
              </button>
            </div>
          </div>
        </ControlStrip>

        {/* Header Block (Cover 200x200) */}
        <div className="pt-[calc(var(--sat)+16px)] flex flex-col items-center text-center px-5 gap-3">
          {loading ? (
            <Skeleton width={200} height={200} radius={24} />
          ) : (
            <div className="w-[200px] h-[200px] rounded-[24px] overflow-hidden bg-surface-2 shadow-2xl flex items-center justify-center">
              {playlist?.artwork || playlist?.coverImageUrl ? (
                <img
                  src={playlist.artwork || playlist.coverImageUrl}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ListMusic size={64} className="text-muted" />
              )}
            </div>
          )}

          {/* Title & Metadata */}
          {loading ? (
            <Skeleton width={180} height={24} radius={8} />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <h1 className="t-h1 text-[24px] font-extrabold text-text line-clamp-2">
                  {playlist?.name || 'Playlist'}
                </h1>
                {playlist?.visibility && (
                  <span className="text-muted">
                    {playlist.visibility === 'private' ? (
                      <Lock size={16} />
                    ) : playlist.visibility === 'unlisted' ? (
                      <LinkIcon size={16} />
                    ) : (
                      <Globe size={16} />
                    )}
                  </span>
                )}
              </div>

              <p className="t-cap text-[13px] text-muted font-medium">
                {[playlist?.isSystem ? 'System' : 'Playlist', `${songs.length} songs`].join(' · ')}
              </p>
            </div>
          )}
        </div>

        {/* Track List */}
        <section className="flex flex-col gap-1 px-2">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <SongRowSkeleton key={n} />
              ))}
            </div>
          ) : songs.length > 0 ? (
            songs.map((song: any, idx: number) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                showIndex
                onPlay={() => handlePlayAll(idx)}
                onRemoveFromPlaylist={() => handleRemoveTrack(song.id)}
              />
            ))
          ) : (
            <div className="py-16 flex flex-col items-center text-center gap-3">
              <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
                <ListMusic size={32} />
              </div>
              <h2 className="t-h2 text-[20px] font-bold text-text">This playlist is empty</h2>
              <p className="t-cap text-[13px] text-muted">Find songs and add them here.</p>
              <Button size="sm" onClick={() => navigate('/search')} className="mt-2">
                <Plus size={16} className="mr-1" />
                <span>Add songs</span>
              </Button>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
