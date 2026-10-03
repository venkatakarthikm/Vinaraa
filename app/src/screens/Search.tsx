import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { music, users } from '@/api/endpoints';
import { Search as SearchIcon, X, SlidersHorizontal, Clock, ArrowUpLeft, CircleAlert } from 'lucide-react';
import { usePlayerStore } from '@/store/player';
import { useSearchStore } from '@/store/search';
import { formatPlayerSong } from '@/utils/song';
import Page from '@/components/Page';
import SongRow from '@/components/SongRow';
import { MediaCard, ArtistCircle } from '@/components/MediaCard';
import Chip from '@/components/Chip';
import Button from '@/components/Button';
import { Sheet } from '@/components/SheetHost';

type SearchType = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

const BROWSE_LANGUAGES = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', color: 'from-purple-900/60 to-pink-900/40' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', color: 'from-cyan-900/60 to-teal-900/40' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', color: 'from-emerald-900/60 to-green-900/40' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', color: 'from-amber-900/60 to-orange-900/40' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', color: 'from-blue-900/60 to-indigo-900/40' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', color: 'from-red-900/60 to-rose-900/40' },
];

export default function Search() {
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);

  // Search Store (Persists search query & results across screen navigations)
  const { query, setQuery, selectedLanguage, setSelectedLanguage, results, setResults } = useSearchStore();

  const [activeType, setActiveType] = useState<SearchType>('all');
  const [history, setHistory] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load history & trending on mount
  useEffect(() => {
    users.searchHistory().then((h) => setHistory(h || [])).catch(() => {});
    music.trending('all').then((res: any) => setTrending(res?.items || [])).catch(() => {});
  }, []);

  // Debounced suggestions & search
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setResults(null);
      setLoading(false);
      return;
    }

    setResults(null);
    setLoading(true);

    const timer = setTimeout(() => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      // Suggestions
      music.suggestions(query.trim(), { signal: abortControllerRef.current.signal })
        .then((sRes: any) => setSuggestions(sRes?.suggestions || []))
        .catch(() => {});

      // Full Search if length >= 2
      if (query.trim().length >= 2) {
        setError(false);
        music.search(
          { q: query.trim(), type: activeType, page: 0, limit: 20, language: selectedLanguage === 'All' ? undefined : selectedLanguage },
          { signal: abortControllerRef.current.signal }
        )
          .then((rRes: any) => {
            setResults(rRes);
            users.addSearchHistory({ query: query.trim() }).catch(() => {});
          })
          .catch((e) => {
            if (e.name !== 'AbortError') setError(true);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, activeType, selectedLanguage, setResults]);

  const handleClearHistory = () => {
    users.clearSearchHistory().then(() => setHistory([])).catch(() => {});
  };

  const handleDeleteHistoryItem = (q: string) => {
    users.deleteSearchHistoryItem(q).then(() => {
      setHistory((prev) => prev.filter((h) => h.query !== q));
    }).catch(() => {});
  };

  const handlePlaySong = (song: any, songList: any[]) => {
    const formatted = songList.map(formatPlayerSong);
    const startIdx = formatted.findIndex((s) => s.id === song.id);
    setQueue(formatted, Math.max(0, startIdx), 'search', query, 'Search Results');
    navigate('/player');
  };

  const types: SearchType[] = ['all', 'songs', 'albums', 'artists', 'playlists'];

  return (
    <Page title="Search" isTabRoot>
      <div className="flex flex-col gap-5 px-5 pt-2 pb-[120px]">
        {/* TOP STICKY SEARCH BAR + TYPE FILTERS */}
        <div className="sticky top-[calc(var(--sat)+12px)] z-20 pt-1 pb-2 bg-bg/90 backdrop-blur-md flex flex-col gap-3">
          {/* Search Input Box */}
          <div className="w-full h-[52px] rounded-[26px] bg-surface-2 border border-line flex items-center px-4 shadow-sm">
            <SearchIcon size={20} className="text-muted mr-3 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs, albums, artists"
              className="w-full bg-transparent outline-none text-text t-body text-[15px] font-medium"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults(null);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text"
                aria-label="Clear search"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Type Filter Chips */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 mr-2">
              {types.map((type) => (
                <Chip
                  key={type}
                  label={type.charAt(0).toUpperCase() + type.slice(1)}
                  selected={activeType === type}
                  onClick={() => setActiveType(type)}
                />
              ))}
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border ${
                selectedLanguage !== 'All'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-2 text-text border-line'
              }`}
              aria-label="Filter"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Floating Suggestions Panel */}
        <AnimatePresence>
          {query.trim().length > 0 && suggestions.length > 0 && !results && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="z-30 w-full bg-surface-3 surface-glass rounded-[24px] border border-line p-2 shadow-2xl overflow-hidden max-h-[280px] overflow-y-auto"
            >
              {suggestions.slice(0, 6).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (item.type === 'album' && item.id) {
                      navigate(`/album/${item.id}`);
                    } else if (item.type === 'artist' && item.id) {
                      navigate(`/artist/${item.id}`);
                    } else if (item.type === 'song' && item.id) {
                      setQueue([formatPlayerSong(item)], 0, 'search', item.id, item.text);
                      navigate('/player');
                    } else {
                      setQuery(item.text || item);
                      setSuggestions([]);
                    }
                  }}
                  className="w-full h-[48px] px-4 flex items-center justify-between hover:bg-surface-2 rounded-[16px] text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SearchIcon size={18} className="text-muted flex-shrink-0" />
                    <span className="t-body text-[15px] font-medium text-text truncate">
                      {item.text || item}
                    </span>
                  </div>
                  {item.subtitle && (
                    <span className="t-micro text-[11px] text-muted font-semibold ml-2 flex-shrink-0">
                      {item.subtitle}
                    </span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* IDLE STATE (Query Empty) */}
        {!query.trim() && (
          <div className="flex flex-col gap-8 pt-2">
            {/* Recent Searches */}
            {history.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="t-h2 text-[20px] font-bold text-text">Recent</h2>
                  <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                    Clear all
                  </Button>
                </div>

                <div className="flex flex-col gap-1">
                  {history.slice(0, 8).map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setQuery(item.query)}
                      className="w-full h-[52px] px-3 rounded-[16px] hover:bg-surface-2 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Clock size={20} className="text-muted flex-shrink-0" />
                        <span className="t-body text-[15px] text-text font-medium truncate">
                          {item.query}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuery(item.query);
                          }}
                          className="p-2 text-muted hover:text-text"
                          aria-label="Fill search"
                        >
                          <ArrowUpLeft size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistoryItem(item.query);
                          }}
                          className="p-2 text-muted hover:text-text"
                          aria-label="Remove search"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Browse By Language Grid */}
            <section className="flex flex-col gap-3">
              <h2 className="t-h2 text-[20px] font-bold text-text">Browse by language</h2>
              <div className="grid grid-cols-2 gap-3">
                {BROWSE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang.label);
                      setQuery(lang.label);
                    }}
                    className={`h-[72px] rounded-[20px] bg-gradient-to-br ${lang.color} p-4 border border-line/40 flex flex-col justify-center text-left shadow-sm active:scale-98 transition-transform`}
                  >
                    <span className="t-h3 text-[16px] font-bold text-white">{lang.native}</span>
                    <span className="t-cap text-[12px] text-white/70">{lang.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Trending Now */}
            {trending.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="t-h2 text-[20px] font-bold text-text">Trending now</h2>
                <div className="flex flex-col divide-y divide-line/20">
                  {trending.slice(0, 5).map((song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      onPlay={() => handlePlaySong(song, trending)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* RESULTS STATE */}
        {query.trim().length >= 2 && (
          <div className="flex flex-col gap-6 pt-2">
            {loading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-[64px] rounded-[16px] bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="py-12 flex flex-col items-center text-center gap-3">
                <CircleAlert size={40} className="text-danger" />
                <h2 className="t-h2 text-[20px] font-bold text-text">Search isn't working right now</h2>
                <Button size="sm" onClick={() => setQuery(query)}>
                  Retry
                </Button>
              </div>
            ) : results ? (
              <div className="flex flex-col gap-6">
                {/* Songs Section */}
                {results.songs?.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h2 className="t-h2 text-[20px] font-bold text-text">Songs</h2>
                    <div className="flex flex-col">
                      {results.songs.slice(0, activeType === 'all' ? 5 : 20).map((song: any) => (
                        <SongRow
                          key={song.id}
                          song={song}
                          onPlay={() => handlePlaySong(song, results.songs)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Albums Rail */}
                {results.albums?.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <h2 className="t-h2 text-[20px] font-bold text-text">Albums</h2>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar">
                      {results.albums.map((album: any) => (
                        <MediaCard
                          key={album.id}
                          id={album.id}
                          title={album.name}
                          subtitle={album.artist}
                          image={album.image}
                          type="album"
                          onClick={() => navigate(`/album/${album.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Artists Rail */}
                {results.artists?.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <h2 className="t-h2 text-[20px] font-bold text-text">Artists</h2>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar">
                      {results.artists.map((artist: any) => (
                        <ArtistCircle
                          key={artist.id}
                          id={artist.id}
                          name={artist.name}
                          image={artist.image}
                          onClick={() => navigate(`/artist/${artist.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Empty Results */}
                {(!results.songs?.length && !results.albums?.length && !results.artists?.length) && (
                  <div className="py-16 flex flex-col items-center text-center gap-3">
                    <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
                      <SearchIcon size={32} />
                    </div>
                    <h2 className="t-h2 text-[20px] font-bold text-text">No results for "{query}"</h2>
                    <p className="t-cap text-[13px] text-muted max-w-[280px]">
                      Check the spelling or try a different language filter.
                    </p>
                    {selectedLanguage !== 'All' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedLanguage('All')}
                        className="mt-2"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Filters Bottom Sheet (§9.8) */}
      <Sheet
        id="search-filters-sheet"
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Search filters"
      >
        <div className="flex flex-col gap-6 py-2">
          <div className="flex flex-col gap-2">
            <h3 className="t-h3 text-[16px] font-semibold text-text">Language</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {['All', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Bengali'].map((lang) => (
                <Chip
                  key={lang}
                  label={lang}
                  selected={selectedLanguage === lang}
                  onClick={() => setSelectedLanguage(lang)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-line">
            <Button variant="ghost" onClick={() => setSelectedLanguage('All')}>
              Reset
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              Apply
            </Button>
          </div>
        </div>
      </Sheet>
    </Page>
  );
}
