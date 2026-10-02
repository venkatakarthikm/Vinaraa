import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { playlists, music } from '@/api/endpoints';
import { ChevronLeft, Play, Shuffle, Globe, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { SongRowSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import SongRow from '@/components/SongRow';
import { listStaggerVariants } from '@/motion';

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setShowPlayer = usePlayerStore((s) => s.setShowPlayer);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    playlists.get(id)
      .then((d) => {
        if (d && (d.tracks?.length || d.songs?.length)) {
          setPlaylist(d); setLoading(false);
        } else {
          return music.editorialPlaylist(id);
        }
      })
      .then((ed) => { if (ed) setPlaylist(ed); setLoading(false); })
      .catch(() => {
        music.editorialPlaylist(id).then((ed) => { if (ed) setPlaylist(ed); setLoading(false); }).catch(() => setLoading(false));
      });
  }, [id]);

  const songs = playlist?.tracks || playlist?.songs || [];

  const handlePlay = (startIndex = 0) => {
    if (!songs.length) return;
    setQueue(songs.map((s: any) => formatPlayerSong(s)), startIndex);
    setShowPlayer(true);
    navigate('/player');
  };

  const removeSong = async (songId: string) => {
    if (!id) return;
    await playlists.removeTrack(id, { songIds: [songId] });
    setPlaylist((pl: any) => ({
      ...pl,
      tracks: (pl.tracks || []).filter((s: any) => (s.songId || s.id || s.saavnId) !== songId),
      songs: (pl.songs || []).filter((s: any) => (s.songId || s.id || s.saavnId) !== songId),
    }));
  };

  const coverUrl = playlist?.coverImageUrl || playlist?.artwork ||
    (Array.isArray(playlist?.image) ? playlist.image[playlist.image.length - 1]?.url : null);
  const canRemove = !playlist?.isSystem && playlist?.isOwner === true;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      <div className="flex-1 overflow-y-auto scroll-y pb-safe">

        {/* Hero */}
        <div className="relative" style={{ height: 260 }}>
          {loading ? (
            <div className="absolute inset-0 shimmer" />
          ) : coverUrl ? (
            <img src={coverUrl} alt={playlist?.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(139,61,255,0.25), rgba(255,61,142,0.18))' }}>
              <ListMusic size={64} style={{ color: 'var(--color-primary-soft)' }} />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(9,7,20,0.7) 60%, #090714 100%)' }} />

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="absolute left-4 z-20 p-2.5 rounded-full"
            style={{ top: `calc(env(safe-area-inset-top) + 12px)`, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
            aria-label="Back"
          >
            <ChevronLeft size={22} color="white" />
          </button>

          {/* Title overlay */}
          {!loading && (
            <div className="absolute bottom-4 left-5 right-5">
              <h1 className="text-2xl font-black text-white drop-shadow-lg line-clamp-2 mb-1">{playlist?.name}</h1>
              <div className="flex items-center gap-2 text-white/60 text-xs">
                {playlist?.visibility === 'public' && <Globe size={11} />}
                <span>{songs.length || playlist?.songCount || 0} songs</span>
                {playlist?.isSystem && (
                  <span className="px-2 py-0.5 rounded-pill font-bold text-[10px]"
                    style={{ background: 'rgba(139,61,255,0.3)', color: 'var(--color-primary-soft)' }}>System</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4">
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
            onClick={() => handlePlay(Math.floor(Math.random() * (songs.length || 1)))}
            disabled={loading}
            className="flex-1 font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid rgba(40,36,77,0.7)' }}
          >
            <Shuffle size={18} />Shuffle
          </motion.button>
        </div>

        {/* Track list */}
        <div className="px-4">
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => <SongRowSkeleton key={i} />)
          ) : songs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <ListMusic size={40} style={{ color: 'var(--color-muted)' }} className="mb-3 opacity-40" />
              <p style={{ color: 'var(--color-muted)' }}>No songs in this playlist yet</p>
            </div>
          ) : (
            songs.map((song: any, i: number) => {
              const formatted = formatPlayerSong(song);
              const songId = song.songId || song.id || song.saavnId;
              return (
                <motion.div
                  key={songId || i}
                  custom={i}
                  variants={listStaggerVariants}
                  initial="initial"
                  animate="animate"
                >
                  <SongRow
                    song={formatted}
                    onPlay={() => handlePlay(i)}
                    onRemoveFromPlaylist={canRemove ? () => removeSong(songId) : undefined}
                  />
                </motion.div>
              );
            })
          )}
        </div>
        <div className="h-6" />
      </div>
    </div>
  );
}
