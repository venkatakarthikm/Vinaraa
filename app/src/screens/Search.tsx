import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { music, users } from '@/api/endpoints';
import { Search as SearchIcon, X, Clock, ArrowUpLeft } from 'lucide-react';
import MiniPlayer from '@/components/MiniPlayer';
import { usePlayerStore } from '@/store/player';
import { getSongImage } from '@/utils/image';
import { formatPlayerSong, getArtistsText } from '@/utils/song';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type SearchTab = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

function SongRow({ song, onPlay, contextQueue }: { song: any; onPlay: (q: any[]) => void; contextQueue: any[] }) {
  return (
    <button onClick={() => onPlay(contextQueue)} className="flex items-center gap-3 px-4 py-3 w-full hover:bg-surface-2/50 transition-colors">
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
        {getSongImage(song) && <img src={getSongImage(song)} alt={song.name} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-text text-sm font-semibold line-clamp-1">{song.name}</p>
        <p className="text-muted text-xs line-clamp-1">
          {getArtistsText(song)}
        </p>
      </div>
      {song.durationMs && (
        <span className="text-muted text-xs flex-shrink-0">
          {Math.floor(song.durationMs / 60000)}:{String(Math.floor((song.durationMs % 60000) / 1000)).padStart(2, '0')}
        </span>
      )}
    </button>
  );
}

function AlbumCard({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-4 py-3 w-full">
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
        {getSongImage(item) && <img src={getSongImage(item)} alt={item.name} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-text text-sm font-semibold line-clamp-1">{item.name}</p>
        <p className="text-muted text-xs capitalize">{item.type || 'Album'} · {item.year}</p>
      </div>
    </button>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [results, setResults] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 250);
  const navigate = useNavigate();

  useEffect(() => {
    users.searchHistory().then((d) => setHistory(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    if (debouncedQuery.length < 2) { setSuggestions([]); setResults(null); return; }
    if (debouncedQuery.length >= 2) {
      music.suggestions(debouncedQuery).then((d) => { if (active) setSuggestions(d?.suggestions || []); }).catch(() => {});
    }
    if (debouncedQuery.length >= 3) {
      setLoading(true);
      music.search({ q: debouncedQuery, type: activeTab }).then((d) => {
        if (active) { setResults(d); setLoading(false); }
      }).catch(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [debouncedQuery, activeTab]);

  const handlePlay = (song: any, contextQueue: any[]) => {
    const queue = contextQueue.map(formatPlayerSong);
    const startIndex = queue.findIndex(s => s.id === (song.id || song.saavnId));
    usePlayerStore.getState().setQueue(queue, startIndex >= 0 ? startIndex : 0);
    usePlayerStore.getState().setShowPlayer(true);
    navigate(`/player/${queue[startIndex >= 0 ? startIndex : 0].id}`, { state: { song } });
  };

  const tabs: SearchTab[] = ['all', 'songs', 'albums', 'artists', 'playlists'];

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="px-4 pt-6 pb-3">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, artists, albums…"
            className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-12 outline-none border border-border focus:border-primary-soft transition-colors"
          />
          {query && (
            <button onClick={() => { setQuery(''); setSuggestions([]); setResults(null); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" aria-label="Clear search">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y pb-safe">
        {!query && (
          <div className="px-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-text font-bold">Recent Searches</h2>
              {history.length > 0 && (
                <button onClick={() => { users.clearSearchHistory(); setHistory([]); }} className="text-muted text-xs">Clear all</button>
              )}
            </div>
            {history.length === 0 ? <p className="text-muted text-sm text-center py-8">Search for your favourite songs</p>
              : history.map((item, i) => (
                <button key={i} onClick={() => setQuery(item.query)} className="flex items-center gap-3 py-3 w-full">
                  <Clock size={16} className="text-muted flex-shrink-0" />
                  <span className="text-text text-sm flex-1 text-left">{item.query}</span>
                  <ArrowUpLeft size={16} className="text-muted" />
                </button>
              ))}
          </div>
        )}

        {query && !results && suggestions.length > 0 && (
          <div className="px-4">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setQuery(s.text)} className="flex items-center gap-3 py-3 w-full">
                <SearchIcon size={16} className="text-muted flex-shrink-0" />
                <span className="text-text text-sm">{s.text}</span>
              </button>
            ))}
          </div>
        )}

        {results && (
          <>
            <div className="flex gap-2 px-4 mb-4 overflow-x-auto scroll-x py-1">
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-semibold transition-all ${activeTab === tab ? 'bg-primary text-white' : 'bg-surface-2 text-muted border border-border'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {loading && (
              <div className="px-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="shimmer w-12 h-12 rounded-xl flex-shrink-0" />
                    <div className="flex-1"><div className="shimmer h-4 w-32 rounded mb-2" /><div className="shimmer h-3 w-20 rounded" /></div>
                  </div>
                ))}
              </div>
            )}
            {!loading && (
              <>
                {(activeTab === 'all' || activeTab === 'songs') && (activeTab === 'all' ? results.songs : results)?.length > 0 && (
                  <div className="mb-4">
                    {activeTab === 'all' && <h3 className="text-text font-bold px-4 mb-2">Songs</h3>}
                    {(activeTab === 'all' ? results.songs : results).slice(0, activeTab === 'all' ? 5 : 30).map((song: any, _: number, arr: any[]) => (
                      <SongRow key={song.id || song.saavnId} song={song} contextQueue={arr} onPlay={(q) => handlePlay(song, q)} />
                    ))}
                  </div>
                )}
                {(activeTab === 'all' || activeTab === 'albums') && (activeTab === 'all' ? results.albums : results)?.length > 0 && (
                  <div className="mb-4">
                    {activeTab === 'all' && <h3 className="text-text font-bold px-4 mb-2">Albums</h3>}
                    {(activeTab === 'all' ? results.albums : results).slice(0, activeTab === 'all' ? 4 : 30).map((item: any) => (
                      <AlbumCard key={item.id} item={item} onClick={() => navigate(`/album/${item.id}`)} />
                    ))}
                  </div>
                )}
                {(activeTab === 'all' || activeTab === 'artists') && (activeTab === 'all' ? results.artists : results)?.length > 0 && (
                  <div className="mb-4">
                    {activeTab === 'all' && <h3 className="text-text font-bold px-4 mb-2">Artists</h3>}
                    {(activeTab === 'all' ? results.artists : results).slice(0, activeTab === 'all' ? 4 : 30).map((item: any) => (
                      <button key={item.id} onClick={() => navigate(`/artist/${item.id}`)}
                        className="flex items-center gap-3 px-4 py-3 w-full">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-surface-2">
                          {getSongImage(item) && <img src={getSongImage(item)} alt={item.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-text text-sm font-semibold">{item.name}</p>
                          <p className="text-muted text-xs">Artist</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {(activeTab === 'all' || activeTab === 'playlists') && (activeTab === 'all' ? results.playlists : results)?.length > 0 && (
                  <div className="mb-4">
                    {activeTab === 'all' && <h3 className="text-text font-bold px-4 mb-2">Playlists</h3>}
                    {(activeTab === 'all' ? results.playlists : results).slice(0, activeTab === 'all' ? 4 : 30).map((item: any) => (
                      <button key={item.id} onClick={() => navigate(`/playlist/${item.id}`)} className="flex items-center gap-3 px-4 py-3 w-full">
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-2">
                          {getSongImage(item) && <img src={getSongImage(item)} alt={item.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-text text-sm font-semibold line-clamp-1">{item.name}</p>
                          <p className="text-muted text-xs capitalize">Playlist</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === 'all' && !results.songs?.length && !results.albums?.length && !results.artists?.length && !results.playlists?.length && (
                  <div className="text-center py-12 px-4"><p className="text-muted">No results for "{query}"</p></div>
                )}
                {activeTab !== 'all' && results.length === 0 && (
                  <div className="text-center py-12 px-4"><p className="text-muted">No results for "{query}"</p></div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <MiniPlayer />
    </div>
  );
}
