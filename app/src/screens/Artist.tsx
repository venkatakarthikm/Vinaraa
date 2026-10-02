import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Shuffle, Share2, Check, Sparkles, Mic2 } from 'lucide-react';
import { music } from '@/api/endpoints';
import Page from '@/components/Page';
import SongRow from '@/components/SongRow';
import { MediaCard } from '@/components/MediaCard';
import { ControlStrip } from '@/components/ControlStrip';
import { Skeleton, SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import { usePlayerStore } from '@/store/player';
import { useUIStore } from '@/store/ui';
import Button from '@/components/Button';

export default function Artist() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToast = useUIStore((s) => s.addToast);

  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    const localFollow = localStorage.getItem(`following:${id}`);
    setIsFollowing(localFollow === 'true');

    music.artist(id)
      .then((d) => {
        if (d) setArtist(d);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleFollow = () => {
    if (!id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    localStorage.setItem(`following:${id}`, String(next));
    addToast(next ? 'Following artist' : 'Unfollowed artist', 'info');
  };

  const topSongs = (artist?.upstreamTopSongs || artist?.songs || []).map(formatPlayerSong);

  const handlePlay = (startIndex = 0) => {
    if (topSongs.length) {
      setQueue(topSongs, startIndex);
      navigate('/player');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: artist?.name,
        text: `${artist?.name} on Vinaraa`,
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
            <Mic2 size={32} />
          </div>
          <h1 className="t-h1 text-[28px] font-bold text-text">Artist not found</h1>
          <p className="t-cap text-[13px] text-muted">We couldn't find that artist.</p>
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
        <ControlStrip>
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => handlePlay(0)}
              className="h-[40px] px-5 rounded-full bg-primary text-on-primary flex items-center gap-2 t-cap text-[13px] font-bold shadow-md active:scale-95 transition-transform"
            >
              <Play size={18} fill="currentColor" />
              <span>Play</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlay(Math.floor(Math.random() * topSongs.length))}
                className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
                aria-label="Shuffle"
              >
                <Shuffle size={18} />
              </button>

              <button
                onClick={toggleFollow}
                className={`h-[40px] px-4 rounded-full flex items-center gap-1.5 t-cap text-[13px] font-bold transition-all ${
                  isFollowing
                    ? 'bg-surface-2 text-primary border border-line'
                    : 'bg-surface-2 text-text border border-line'
                }`}
              >
                {isFollowing ? <Check size={16} /> : null}
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
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

        <div className="relative w-full h-[300px] overflow-hidden bg-surface-2">
          {loading ? (
            <Skeleton width="100%" height={300} />
          ) : (
            <>
              {artist?.image && (
                <img
                  src={artist.image}
                  alt={artist.name}
                  className="w-full h-full object-cover object-[center_25%]"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-bg" />

              <div className="absolute bottom-4 left-5 right-5 flex flex-col">
                {artist?.matchPercent && (
                  <div className="flex items-center gap-1 text-primary t-micro text-[11px] font-bold mb-1">
                    <Sparkles size={12} />
                    <span>{artist.matchPercent}% match</span>
                  </div>
                )}
                <h1 className="t-display text-[36px] leading-[44px] font-extrabold text-white drop-shadow-md">
                  {artist?.name}
                </h1>
                {artist?.followerCount && (
                  <p className="t-cap text-[13px] text-white/70">
                    {artist.followerCount} followers
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <section className="flex flex-col gap-2 px-2">
          <div className="flex items-center justify-between px-3">
            <h2 className="t-h2 text-[20px] font-bold text-text">Popular songs</h2>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <SongRowSkeleton key={n} />
              ))}
            </div>
          ) : (
            topSongs.slice(0, 5).map((song: any, idx: number) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                showIndex
                onPlay={() => handlePlay(idx)}
              />
            ))
          )}
        </section>

        {!loading && artist?.albums?.length > 0 && (
          <section className="flex flex-col gap-3 px-5">
            <h2 className="t-h2 text-[20px] font-bold text-text">Albums</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {artist.albums.map((album: any) => (
                <MediaCard
                  key={album.id}
                  id={album.id}
                  title={album.name}
                  subtitle={album.year}
                  image={album.image}
                  type="album"
                  onClick={() => navigate(`/album/${album.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Page>
  );
}
