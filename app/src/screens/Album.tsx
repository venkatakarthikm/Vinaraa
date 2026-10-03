import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Shuffle, Download, ArrowUpDown, Share2, Mic2, Disc3 } from 'lucide-react';
import { music } from '@/api/endpoints';
import Page from '@/components/Page';
import SongRow from '@/components/SongRow';
import Chip from '@/components/Chip';
import { ControlStrip } from '@/components/ControlStrip';
import { Skeleton, SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import { usePlayerStore } from '@/store/player';
import { useUIStore } from '@/store/ui';
import Button from '@/components/Button';

export default function Album() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToast = useUIStore((s) => s.addToast);

  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    music.album(id)
      .then((d) => {
        if (d && (d.songs?.length || d.tracks?.length)) {
          setAlbum(d);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const songs = (album?.songs || album?.tracks || []).map(formatPlayerSong);

  const handlePlayAll = (startIndex = 0) => {
    if (songs.length) {
      setQueue(songs, startIndex, 'album', album?.id, album?.name);
      navigate('/player');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: album?.name,
        text: `${album?.name} on Vinaraa`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      addToast('Copied link', 'info');
    }
  };

  if (notFound) {
    return (
      <Page>
        <div className="py-20 flex flex-col items-center text-center px-5 gap-3">
          <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
            <Disc3 size={32} />
          </div>
          <h1 className="t-h1 text-[28px] font-bold text-text">Album not available</h1>
          <p className="t-cap text-[13px] text-muted">It may have been removed.</p>
          <Button size="sm" onClick={() => navigate(-1)} className="mt-2">
            Go back
          </Button>
        </div>
      </Page>
    );
  }

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
                onClick={handleShare}
                className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="Share"
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>
        </ControlStrip>

        {/* Header Block */}
        <div className="relative pt-[calc(var(--sat)+16px)] flex flex-col items-center text-center px-5 gap-3">
          {loading ? (
            <Skeleton width={240} height={240} radius={24} />
          ) : (
            <div className="w-[240px] h-[240px] rounded-[24px] overflow-hidden bg-surface-2 shadow-2xl">
              {album?.image ? (
                <img src={album.image} alt={album.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  <Disc3 size={64} />
                </div>
              )}
            </div>
          )}

          {loading ? (
            <Skeleton width={180} height={24} radius={8} />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <h1 className="t-h1 text-[24px] font-extrabold text-text line-clamp-2">
                {album?.name}
              </h1>
              <p className="t-cap text-[13px] text-muted font-medium">
                {[album?.year, album?.language, `${songs.length} songs`].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}
        </div>

        {/* Credits Row */}
        {!loading && album?.artists?.length > 0 && (
          <div className="px-5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {album.artists.map((artist: any) => (
                <Chip
                  key={artist.id || artist.name}
                  label={artist.name}
                  icon={Mic2}
                  onClick={() => artist.id && navigate(`/artist/${artist.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Track List */}
        <section className="flex flex-col gap-1 px-2">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SongRowSkeleton key={n} />
              ))}
            </div>
          ) : (
            songs.map((song: any, idx: number) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                showIndex
                onPlay={() => handlePlayAll(idx)}
              />
            ))
          )}
        </section>

        {/* Footer */}
        {!loading && (
          <div className="px-5 text-center py-4">
            <p className="t-cap text-[12px] text-muted">
              {songs.length} songs
            </p>
          </div>
        )}
      </div>
    </Page>
  );
}
