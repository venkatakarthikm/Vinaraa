import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { music, users } from '@/api/endpoints';
import { X, Clock, ArrowUpLeft, Search as SearchIcon, Mic2, Music2, Disc3, ListMusic, AlertCircle, RefreshCw } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const [history, setHistory] = useState<any[]>([]);
  const debouncedQuery = useDebounce(query, 280);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const requestIdRef = useRef(0);
  const suggestionsReqIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    users.searchHistory().then((d) => setHistory(d || [])).catch(() => {});
  }, []);

  const cancelPendingRequests = useCallback(() => {
    searchAbortRef.current?.abort();
    suggestionsAbortRef.current?.abort();
    requestIdRef.current++;
    suggestionsReqIdRef.current++;
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    suggestionsAbortRef.current?.abort();
    const controller = new AbortController();
    suggestionsAbortRef.current = controller;
    const reqId = ++suggestionsReqIdRef.current;

    setLoadingSuggestions(true);
    try {
      const d = await music.suggestions(q.trim(), { signal: controller.signal });
      if (reqId === suggestionsReqIdRef.current) {
        setSuggestions(d?.suggestions || []);
        setLoadingSuggestions(false);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && reqId === suggestionsReqIdRef.current) {
        setLoadingSuggestions(false);
      }
    }
  }, []);

  const executeSearch = useCallback(async (q: string, tab: SearchTab, searchPage: number, append = false) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    if (searchPage === 0) {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setLoading(true);
      setSearchError(null);
      if (!append) setResults(null);
    } else {
      setLoadingMore(true);
    }

    const currentController = searchAbortRef.current;
    const reqId = ++requestIdRef.current;

    try {
      if (/jiosaavn\.com\/album\//i.test(trimmed) || /saavn\.com\/album\//i.test(trimmed)) {
        if (searchPage === 0) {
          const resolved = await music.resolveAlbumLink(trimmed);
          if (reqId === requestIdRef.current && resolved?.id) {
            navigate(`/album/${resolved.id}`);
            return;
          }
        }
      }

      const res = await music.search(
        { q: trimmed, type: tab, page: searchPage, limit: 20 },
        { signal: currentController?.signal }
      );

      if (reqId !== requestIdRef.current) return;

      if (tab === 'all') {
        setResults(res);
        setHasMore(false);
      } else {
        const newData = Array.isArray(res) ? res : (res?.items || []);
        setResults((prev: any) => {
          if (searchPage === 0) {
            setHasMore(newData.length >= 20);
            return newData;
          }
          const prevArr = Array.isArray(prev) ? prev : [];
          const existingIds = new Set(prevArr.map((x: any) => x.id || x.saavnId));
          const filtered = newData.filter((x: any) => !existingIds.has(x.id || x.saavnId));
          setHasMore(newData.length > 0 && filtered.length > 0);
          return [...prevArr, ...filtered];
        });
      }
      setLoading(false);
      setLoadingMore(false);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        if (searchPage === 0) {
          setSearchError(err?.message || 'Search failed. Check your connection.');
        }
      }
    }
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(-1);
    setSearchError(null);
    cancelPendingRequests();

    if (!val.trim()) {
      setIsSuggestionsOpen(false);
      setSuggestions([]);
      setResults(null);
      setLoading(false);
    } else {
      setIsSuggestionsOpen(true);
      setResults(null);
    }
  };

  const handleInputFocus = () => {
    if (query.trim()) {
      setIsSuggestionsOpen(true);
      if (suggestions.length === 0) {
        fetchSuggestions(query.trim());
      }
    }
  };

  useEffect(() => {
    if (!query.trim()) return;
    if (isSuggestionsOpen && query.trim().length >= 2) {
      fetchSuggestions(query.trim());
    }
    if (query.trim().length >= 3) {
      executeSearch(query.trim(), activeTab, 0);
    }
  }, [debouncedQuery]);

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    setPage(0);
    setSelectedIndex(-1);
    cancelPendingRequests();
    if (query.trim().length >= 3) {
      executeSearch(query.trim(), tab, 0);
    }
  };

  const handleSelectSuggestion = (s: any) => {
    cancelPendingRequests();
    setIsSuggestionsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);

    if (s.type === 'album' && s.id) {
      navigate(`/album/${s.id}`);
      return;
    }
    if (s.type === 'artist' && s.id) {
      navigate(`/artist/${s.id}`);
      return;
    }
    if (s.type === 'playlist' && s.id) {
      navigate(`/playlist/${s.id}`);
      return;
    }
    if (s.type === 'song' && s.id) {
      music.song(s.id).then((songRes) => {
        if (songRes) {
          usePlayerStore.getState().setQueue([formatPlayerSong(songRes)], 0);
        }
      }).catch(() => {});
      return;
    }

    const searchText = s.text || query;
    setQuery(searchText);
    setPage(0);
    executeSearch(searchText, activeTab, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isSuggestionsOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Escape') {
        setIsSuggestionsOpen(false);
        setSelectedIndex(-1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (query.trim()) {
          setIsSuggestionsOpen(false);
          setPage(0);
          executeSearch(query.trim(), activeTab, 0);
        }
        return;
      }
    } else if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      setIsSuggestionsOpen(false);
      setPage(0);
      executeSearch(query.trim(), activeTab, 0);
    }
  };

  const handleClear = () => {
    cancelPendingRequests();
    setQuery('');
    setSuggestions([]);
    setResults(null);
    setIsSuggestionsOpen(false);
    setSearchError(null);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    executeSearch(query.trim(), activeTab, nextPage, true);
  };

  const handlePlay = (song: any, contextQueue: any[]) => {
    const queue = contextQueue.map(formatPlayerSong);
    const startIndex = queue.findIndex(s => s.id === (song.id || song.saavnId));
    usePlayerStore.getState().setQueue(queue, startIndex >= 0 ? startIndex : 0);
  };

  const tabs: SearchTab[] = ['all', 'songs', 'albums', 'artists', 'playlists'];
  const hasResults = results && (
    results.songs?.length || results.albums?.length || results.artists?.length || results.playlists?.length ||
    (Array.isArray(results) && results.length > 0)
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
            role="combobox"
            aria-expanded={isSuggestionsOpen}
            aria-controls="search-suggestions-listbox"
            aria-activedescendant={selectedIndex >= 0 ? `suggestion-option-${selectedIndex}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
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
                onClick={handleClear}
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
                      key={`history-${item.query}-${i}`}
                      custom={i}
                      variants={listStaggerVariants}
                      initial="initial"
                      animate="animate"
                      onClick={() => {
                        setQuery(item.query);
                        setIsSuggestionsOpen(false);
                        setPage(0);
                        executeSearch(item.query, activeTab, 0);
                      }}
                      className="flex items-center gap-3 py-3 rounded-xl hover:bg-white/5 px-2 text-left"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,61,255,0.15)' }}>
                        <Clock size={14} style={{ color: 'var(--color-primary-soft)' }} />
                      </div>
                      <span className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>{item.query}</span>
                      <ArrowUpLeft size={14} style={{ color: 'var(--color-muted)' }} />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 mb-4">
              <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text)' }}>Browse</h2>
              <div className="grid grid-cols-2 gap-3">
                {BROWSE_CATEGORIES.map((cat, i) => (
                  <motion.button
                    key={`cat-${cat.label}`}
                    custom={i}
                    variants={listStaggerVariants}
                    initial="initial"
                    animate="animate"
                    onClick={() => {
                      setQuery(cat.label);
                      setIsSuggestionsOpen(false);
                      setPage(0);
                      executeSearch(cat.label, activeTab, 0);
                    }}
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

        {/* Suggestions dropdown */}
        {query && isSuggestionsOpen && (
          <motion.div
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            id="search-suggestions-listbox"
            role="listbox"
            aria-label="Search Suggestions"
            className="px-4 py-2"
          >
            {loadingSuggestions && suggestions.length === 0 && (
              <div className="py-4 text-center text-xs text-muted flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-primary-soft border-t-transparent rounded-full animate-spin" />
                Loading suggestions…
              </div>
            )}

            {suggestions.map((s, i) => {
              const isSelected = selectedIndex === i;
              const stableKey = `${s.type || 'item'}-${s.id || s.text}`;
              return (
                <motion.button
                  key={stableKey}
                  id={`suggestion-option-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  custom={i}
                  variants={listStaggerVariants}
                  initial="initial"
                  animate="animate"
                  onClick={() => handleSelectSuggestion(s)}
                  className={`flex items-center gap-3 py-3 w-full rounded-xl transition-colors px-3 text-left ${
                    isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  {s.image ? (
                    <img src={s.image} alt={s.text} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <SearchIcon size={15} style={{ color: 'var(--color-muted)' }} className="flex-shrink-0 ml-1" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>{s.text}</p>
                    {s.subtitle && <p className="text-xs line-clamp-1" style={{ color: 'var(--color-muted)' }}>{s.subtitle}</p>}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* Full results */}
        {query && !isSuggestionsOpen && (
          <>
            {/* Filter chips */}
            <div className="flex gap-2 px-4 mb-4 overflow-x-auto scroll-x py-1 flex-shrink-0">
              {tabs.map((tab) => (
                <motion.button
                  key={`tab-${tab}`}
                  onClick={() => handleTabChange(tab)}
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

            {/* Error State */}
            {searchError && !loading && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <AlertCircle size={40} className="text-danger mb-3 opacity-80" />
                <p className="text-text font-bold text-base mb-1">Search Error</p>
                <p className="text-muted text-xs mb-4 max-w-xs">{searchError}</p>
                <button
                  onClick={() => executeSearch(query.trim(), activeTab, 0)}
                  className="flex items-center gap-2 bg-surface-2 border border-border px-4 py-2 rounded-full text-xs font-bold text-text hover:bg-surface"
                >
                  <RefreshCw size={14} /> Retry Search
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {loading && !searchError && (
              <div className="px-4 flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={`skel-${i}`} className="flex items-center gap-3 py-2">
                    <div className="shimmer w-12 h-12 rounded-xl flex-shrink-0" />
                    <div className="flex-1">
                      <div className="shimmer h-3.5 w-36 rounded mb-2" />
                      <div className="shimmer h-3 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !searchError && results && (
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fadeVariants} initial="initial" animate="animate" exit="exit">
                  {/* Songs section */}
                  {(activeTab === 'all' || activeTab === 'songs') && (activeTab === 'all' ? results.songs : results)?.length > 0 && (
                    <div className="mb-4 px-4">
                      {activeTab === 'all' && (
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--color-muted)' }}>Songs</p>
                      )}
                      {(activeTab === 'all' ? results.songs : results).slice(0, activeTab === 'all' ? 5 : 50).map((song: any, _: number, arr: any[]) => (
                        <SongRow key={`song-${song.id || song.saavnId}`} song={song} onPlay={() => handlePlay(song, arr)} />
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
                        <EntityRow key={`album-${item.id}`} item={item} type="albums" onClick={() => navigate(`/album/${item.id}`)} />
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
                        <EntityRow key={`artist-${item.id}`} item={item} type="artists" onClick={() => navigate(`/artist/${item.id}`)} />
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
                        <EntityRow key={`playlist-${item.id}`} item={item} type="playlists" onClick={() => navigate(`/playlist/${item.id}`)} />
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {!hasResults && (
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
                        onClick={handleLoadMore}
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
