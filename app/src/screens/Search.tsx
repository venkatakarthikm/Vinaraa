import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { music, users } from '@/api/endpoints';
import { X, Clock, ArrowUpLeft, Search as SearchIcon, Mic2, Music2, Disc3, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { getSongImage } from '@/utils/image';
import { formatPlayerSong, getArtistsText } from '@/utils/song';
import { listStaggerVariants, fadeVariants } from '@/motion';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type SearchTab = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

const TAB_ICONS: Record<SearchTab, React.ReactNode> = {
  all:       <SearchIcon size={13} />,
  songs:     <Music2 size={13} />,
  albums:    <Disc3 size={13} />,
  artists:   <Mic2 size={13} />,
  playlists: <ListMusic size={13} />,
};

function SongRow({ song, onPlay }: { song: any; onPlay: () => void }) {
  const durationSec = song.durationMs ? Math.floor(song.durationMs / 1000) : 0;
  const mins = Math.floor(durationSec / 60);
  const secs = String(durationSec % 60).padStart(2, '0');
  return (
    <motion.button
      onClick={onPlay}
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-3 px-4 py-3 w-full hover:bg-white/5 active:bg-white/10 rounded-xl transition-colors"
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 relative">
        {getSongImage(song) && (
          <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>{song.name}</p>
        <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-muted)' }}>{getArtistsText(song)}</p>
      </div>
      {durationSec > 0 && (
        <span className="text-xs flex-shrink-0 font-mono" style={{ color: 'var(--color-muted)' }}>
          {mins}:{secs}
        </span>
      )}
    </motion.button>
  );
}

function EntityRow({ item, type, onClick }: { item: any; type: string; onClick: () => void }) {
  const isArtist = type === 'artists';
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-3 px-4 py-3 w-full hover:bg-white/5 rounded-xl transition-colors"
    >
      <div
        className={`w-12 h-12 overflow-hidden flex-shrink-0 bg-white/5 ${isArtist ? 'rounded-full' : 'rounded-xl'}`}
      >
        {getSongImage(item) && (
          <img src={getSongImage(item)} alt={item.name} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>{item.name}</p>
        <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {type === 'albums' ? `Album${item.year ? ` · ${item.year}` : ''}` : type === 'playlists' ? 'Playlist' : 'Artist'}
        </p>
      </div>
    </motion.button>
  );
}

const BROWSE_CATEGORIES = [
  { label: 'Telugu Hits',   color: '#8B3DFF', emoji: '🎬' },
  { label: 'Bollywood',     color: '#FF3D8E', emoji: '🎵' },
  { label: 'Tamil',         color: '#2DE1B5', emoji: '🎶' },
  { label: 'Punjabi',       color: '#FFC247', emoji: '🔥' },
  { label: 'Devotional',    color: '#FF7A5A', emoji: '🙏' },
  { label: 'Chill Vibes',   color: '#00BFFF', emoji: '☁️' },
  { label: 'Party',         color: '#FF3D8E', emoji: '🎉' },
  { label: 'Classical',     color: '#B57BFF', emoji: '🎻' },
];

export default function Search() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [results, setResults] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 280);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(0);
    setResults(null);
    setHasMore(false);
  }, [debouncedQuery, activeTab]);

  useEffect(() => {
    users.searchHistory().then((d) => setHistory(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    if (debouncedQuery.length < 2) { setSuggestions([]); setResults(null); return; }
    if (debouncedQuery.length >= 2 && page === 0) {
      music.suggestions(debouncedQuery).then((d) => { if (active) setSuggestions(d?.suggestions || []); }).catch(() => {});
    }
    if (debouncedQuery.length >= 3) {
      if (/jiosaavn\.com\/album\//i.test(debouncedQuery) || /saavn\.com\/album\//i.test(debouncedQuery)) {
        if (page === 0) {
          setLoading(true);
          music.resolveAlbumLink(debouncedQuery).then(d => {
            if (active && d && d.id) {
              navigate(`/album/${d.id}`);
            }
          }).catch(() => {
            if (active) { setLoading(false); setResults(null); }
          });
        }
        return;
      }
      
      if (page === 0) setLoading(true);
      else setLoadingMore(true);
      
      music.search({ q: debouncedQuery, type: activeTab, page, limit: 20 }).then((d) => {
        if (!active) return;
        if (activeTab === 'all') {
          setResults(d);
          setHasMore(false);
        } else {
          const newData = Array.isArray(d) ? d : [];
          setResults((prev: any) => {
            if (page === 0) {
              setHasMore(newData.length >= 20);
              return newData;
            }
            // Deduplicate by id/saavnId
            const prevArr = Array.isArray(prev) ? prev : [];
            const existingIds = new Set(prevArr.map(x => x.id || x.saavnId));
            const filtered = newData.filter(x => !existingIds.has(x.id || x.saavnId));
            setHasMore(newData.length > 0 && filtered.length > 0); 
            return [...prevArr, ...filtered];
          });
        }
        setLoading(false);
        setLoadingMore(false);
      }).catch(() => { 
        if (active) { setLoading(false); setLoadingMore(false); }
      });
    }
    return () => { active = false; };
  }, [debouncedQuery, activeTab, page]);

  const handlePlay = (song: any, contextQueue: any[]) => {
    const queue = contextQueue.map(formatPlayerSong);
    const startIndex = queue.findIndex(s => s.id === (song.id || song.saavnId));
    usePlayerStore.getState().setQueue(queue, startIndex >= 0 ? startIndex : 0);
  };

  const tabs: SearchTab[] = ['all', 'songs', 'albums', 'artists', 'playlists'];
  const hasResults = results && (
    results.songs?.length || results.albums?.length || results.artists?.length || results.playlists?.length ||
    (Array.isArray(results) && results.length)
  );

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Search Bar Header */}
      <div
        className="flex-shrink-0 px-4 pt-safe"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 16px)`,
          paddingBottom: 12,
          background: 'rgba(9,7,20,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="relative flex items-center">
          <SearchIcon
            className="absolute left-4 z-10 pointer-events-none"
            size={18}
            style={{ color: query ? 'var(--color-primary-soft)' : 'var(--color-muted)' }}
          />
          <input
            ref={inputRef}
            id="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, artists, albums…"
            className="w-full rounded-2xl py-3.5 pl-11 pr-12 text-sm font-medium outline-none"
            style={{
              background: 'rgba(27,24,54,0.8)',
              color: 'var(--color-text)',
              border: `1px solid ${query ? 'rgba(139,61,255,0.5)' : 'rgba(40,36,77,0.6)'}`,
              transition: 'border-color 0.2s ease',
            }}
          />
          <AnimatePresence>
            {query && (
              <motion.button
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onClick={() => { setQuery(''); setSuggestions([]); setResults(null); inputRef.current?.focus(); }}
                className="absolute right-3 p-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.1)' }}
                aria-label="Clear search"
              >
                <X size={14} style={{ color: 'var(--color-muted)' }} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        {/* No query — show browse categories + history */}
        {!query && (
          <motion.div variants={fadeVariants} initial="initial" animate="animate">
            {/* Recent Searches */}
            {history.length > 0 && (
              <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>Recent</h2>
                  <button
                    onClick={() => { users.clearSearchHistory?.(); setHistory([]); }}
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-col">
                  {history.slice(0, 6).map((item, i) => (
                    <motion.button
                      key={i}
                      custom={i}
                      variants={listStaggerVariants}
                      initial="initial"
                      animate="animate"
                      onClick={() => setQuery(item.query)}
                      className="flex items-center gap-3 py-3 rounded-xl hover:bg-white/5 px-2"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,61,255,0.15)' }}>
                        <Clock size={14} style={{ color: 'var(--color-primary-soft)' }} />
                      </div>
                      <span className="text-sm flex-1 text-left" style={{ color: 'var(--color-text)' }}>{item.query}</span>
                      <ArrowUpLeft size={14} style={{ color: 'var(--color-muted)' }} />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Browse categories */}
            <div className="px-4 mb-4">
              <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>Browse</h2>
              <div className="grid grid-cols-2 gap-3">
                {BROWSE_CATEGORIES.map((cat, i) => (
                  <motion.button
                    key={cat.label}
                    custom={i}
                    variants={listStaggerVariants}
                    initial="initial"
                    animate="animate"
                    onClick={() => setQuery(cat.label)}
                    whileTap={{ scale: 0.96 }}
                    className="relative h-20 rounded-2xl overflow-hidden flex items-center px-4 gap-2 text-left"
                    style={{ background: `linear-gradient(135deg, ${cat.color}CC, ${cat.color}55)` }}
                  >
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className="text-white font-bold text-sm leading-tight">{cat.label}</span>
                    <div className="absolute right-3 bottom-3 w-10 h-10 rounded-full opacity-20"
                      style={{ background: cat.color, filter: 'blur(12px)' }} />
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Suggestions (while typing, before full results) */}
        {query && !results && suggestions.length > 0 && (
          <motion.div variants={fadeVariants} initial="initial" animate="animate" className="px-4">
            {suggestions.map((s, i) => (
              <motion.button
                key={i}
                custom={i}
                variants={listStaggerVariants}
                initial="initial"
                animate="animate"
                onClick={() => setQuery(s.text)}
                className="flex items-center gap-3 py-3 w-full rounded-xl hover:bg-white/5 px-2"
              >
                <SearchIcon size={15} style={{ color: 'var(--color-muted)' }} className="flex-shrink-0" />
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{s.text}</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Full results */}
        {results && (
          <>
            {/* Filter chips */}
            <div className="flex gap-2 px-4 mb-4 overflow-x-auto scroll-x py-1 flex-shrink-0">
              {tabs.map((tab) => (
                <motion.button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  whileTap={{ scale: 0.95 }}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-xs font-bold transition-all"
                  style={
                    activeTab === tab
                      ? { background: 'var(--color-primary)', color: 'white' }
                      : { background: 'rgba(27,24,54,0.8)', color: 'var(--color-muted)', border: '1px solid rgba(40,36,77,0.7)' }
                  }
                >
                  {TAB_ICONS[tab]}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </motion.button>
              ))}
            </div>

            {/* Loading skeletons */}
            {loading && (
              <div className="px-4 flex flex-col gap-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="shimmer w-12 h-12 rounded-xl flex-shrink-0" />
                    <div className="flex-1">
                      <div className="shimmer h-3.5 w-36 rounded mb-2" />
                      <div className="shimmer h-3 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && (
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fadeVariants} initial="initial" animate="animate" exit="exit">
                  {/* Songs section */}
                  {(activeTab === 'all' || activeTab === 'songs') && (activeTab === 'all' ? results.songs : results)?.length > 0 && (
                    <div className="mb-4 px-4">
                      {activeTab === 'all' && (
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--color-muted)' }}>Songs</p>
                      )}
                      {(activeTab === 'all' ? results.songs : results).slice(0, activeTab === 'all' ? 5 : 50).map((song: any, _: number, arr: any[]) => (
                        <SongRow key={song.id || song.saavnId} song={song} onPlay={() => handlePlay(song, arr)} />
                      ))}
                    </div>
                  )}

                  {/* Albums section */}
                  {(activeTab === 'all' || activeTab === 'albums') && (activeTab === 'all' ? results.albums : results)?.length > 0 && (
                    <div className="mb-4 px-4">
                      {activeTab === 'all' && (
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--color-muted)' }}>Albums</p>
                      )}
                      {(activeTab === 'all' ? results.albums : results).slice(0, activeTab === 'all' ? 4 : 50).map((item: any) => (
                        <EntityRow key={item.id} item={item} type="albums" onClick={() => navigate(`/album/${item.id}`)} />
                      ))}
                    </div>
                  )}

                  {/* Artists section */}
                  {(activeTab === 'all' || activeTab === 'artists') && (activeTab === 'all' ? results.artists : results)?.length > 0 && (
                    <div className="mb-4 px-4">
                      {activeTab === 'all' && (
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--color-muted)' }}>Artists</p>
                      )}
                      {(activeTab === 'all' ? results.artists : results).slice(0, activeTab === 'all' ? 4 : 50).map((item: any) => (
                        <EntityRow key={item.id} item={item} type="artists" onClick={() => navigate(`/artist/${item.id}`)} />
                      ))}
                    </div>
                  )}

                  {/* Playlists section */}
                  {(activeTab === 'all' || activeTab === 'playlists') && (activeTab === 'all' ? results.playlists : results)?.length > 0 && (
                    <div className="mb-4 px-4">
                      {activeTab === 'all' && (
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--color-muted)' }}>Playlists</p>
                      )}
                      {(activeTab === 'all' ? results.playlists : results).slice(0, activeTab === 'all' ? 4 : 50).map((item: any) => (
                        <EntityRow key={item.id} item={item} type="playlists" onClick={() => navigate(`/playlist/${item.id}`)} />
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {!hasResults && !loading && (
                    <div className="flex flex-col items-center py-16 px-4">
                      <SearchIcon size={48} style={{ color: 'var(--color-muted)' }} className="mb-4 opacity-40" />
                      <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>No results for</p>
                      <p className="font-bold text-lg" style={{ color: 'var(--color-primary-soft)' }}>"{query}"</p>
                      <p className="text-sm mt-2 text-center" style={{ color: 'var(--color-muted)' }}>Try a different spelling or keyword</p>
                    </div>
                  )}

                  {/* Load More Button */}
                  {hasResults && activeTab !== 'all' && hasMore && (
                    <div className="px-4 pb-8 pt-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setPage(p => p + 1)}
                        disabled={loadingMore}
                        className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        style={{ 
                          background: loadingMore ? 'rgba(255,255,255,0.05)' : 'var(--color-surface-2)', 
                          color: 'var(--color-text)', 
                          border: '1px solid rgba(40,36,77,0.6)' 
                        }}
                      >
                        {loadingMore ? (
                           <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : 'Load More'}
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </div>
  );
}
