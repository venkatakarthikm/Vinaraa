import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { stats } from '@/api/endpoints';
import {
  Share2, Sparkles, ChartColumn, CircleAlert, Languages, Mic2, Music2,
  PersonStanding, Film, Disc3, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import Page from '@/components/Page';
import Chip from '@/components/Chip';
import { ControlStrip } from '@/components/ControlStrip';
import SongRow from '@/components/SongRow';
import { formatPlayerSong } from '@/utils/song';
import { getMediaImage } from '@/utils/image';
import { usePlayerStore } from '@/store/player';
import { useUIStore } from '@/store/ui';
import Button from '@/components/Button';

const RANGES = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '180d', value: '180d' },
  { label: 'All', value: 'all' },
];

type StatsTab = 'analytics' | 'history';

function formatDateGroup(dateStr?: string): string {
  if (!dateStr) return 'Earlier';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (targetDate.getTime() === today.getTime()) return 'Today';
  if (targetDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Stats() {
  const navigate = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToast = useUIStore((s) => s.addToast);

  const [tab, setTab] = useState<StatsTab>('analytics');
  const [range, setRange] = useState('30d');

  // Analytics Query
  const { data: dashboard, isLoading: loadingDash, isError: errorDash, refetch: refetchDash } = useQuery({
    queryKey: ['stats', 'dashboard', range],
    queryFn: () => stats.dashboard(range),
    staleTime: 2 * 60 * 1000,
    enabled: tab === 'analytics',
  });

  // History Infinite Query
  const {
    data: historyData,
    isLoading: loadingHistory,
    isError: errorHistory,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchHistory,
  } = useInfiniteQuery({
    queryKey: ['stats', 'history'],
    queryFn: ({ pageParam = 0 }) => stats.sessions({ page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, allPages) => {
      const sessions = lastPage?.sessions || lastPage?.items || lastPage?.data || [];
      return sessions.length === 20 ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 60 * 1000,
    enabled: tab === 'history',
  });

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My Vinaraa Stats',
        text: `Check out my music stats on Vinaraa!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      addToast('Copied stats summary', 'info');
    }
  };

  const overview = dashboard?.overview;

  // Aggregate all history sessions into grouped sections
  const rawHistoryPages = historyData?.pages || [];
  const allSessions: any[] = rawHistoryPages.flatMap(
    (page) => page?.sessions || page?.items || page?.data || []
  );

  const groupedHistory: { [key: string]: any[] } = {};
  allSessions.forEach((sess) => {
    const key = formatDateGroup(sess.startedAt || sess.createdAt);
    if (!groupedHistory[key]) groupedHistory[key] = [];
    groupedHistory[key].push(sess);
  });

  const TOP_SECTIONS = [
    { key: 'languages', title: 'Languages', icon: Languages },
    { key: 'singers', title: 'Top singers', icon: Mic2 },
    { key: 'directors', title: 'Music directors', icon: Music2 },
    { key: 'actors', title: 'Heroes & actors', icon: PersonStanding },
    { key: 'movies', title: 'Movies', icon: Film },
    { key: 'songs', title: 'Songs', icon: Disc3 },
  ];

  return (
    <Page
      title="Your stats"
      isTabRoot
      headerActions={
        <button
          onClick={handleShare}
          className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
          aria-label="Share stats"
        >
          <Share2 size={20} />
        </button>
      }
    >
      <div className="flex flex-col gap-6 px-5 pt-2 pb-[120px]">
        {/* Segmented Control (Analytics | History) */}
        <div className="h-[48px] bg-surface-2 p-1 rounded-[24px] flex items-center shadow-inner">
          <button
            onClick={() => setTab('analytics')}
            className={`flex-1 h-full rounded-[20px] t-cap text-[14px] font-bold transition-all ${
              tab === 'analytics' ? 'bg-primary text-on-primary shadow-sm' : 'text-muted'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 h-full rounded-[20px] t-cap text-[14px] font-bold transition-all ${
              tab === 'history' ? 'bg-primary text-on-primary shadow-sm' : 'text-muted'
            }`}
          >
            History
          </button>
        </div>

        {/* ANALYTICS TAB CONTENT */}
        {tab === 'analytics' && (
          <div className="flex flex-col gap-6">
            <ControlStrip>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full">
                {RANGES.map((r) => (
                  <Chip
                    key={r.value}
                    label={r.label}
                    selected={range === r.value}
                    onClick={() => setRange(r.value)}
                  />
                ))}
              </div>
            </ControlStrip>

            {loadingDash ? (
              <div className="flex flex-col gap-4">
                <div className="h-[140px] rounded-[28px] bg-surface-2 animate-pulse" />
                <div className="h-[96px] rounded-[28px] bg-surface-2 animate-pulse" />
                <div className="h-[160px] rounded-[28px] bg-surface-2 animate-pulse" />
              </div>
            ) : errorDash ? (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <CircleAlert size={40} className="text-danger" />
                <h2 className="t-h2 text-[20px] font-bold text-text">Couldn't load stats</h2>
                <Button size="sm" onClick={() => refetchDash()}>
                  Retry
                </Button>
              </div>
            ) : overview?.plays ? (
              <div className="flex flex-col gap-6">
                {/* Total Time Card */}
                <div className="w-full bg-surface p-6 rounded-[28px] border border-line flex flex-col gap-4">
                  <span className="t-cap text-[13px] text-muted">Time listened</span>
                  <h1 className="t-display text-[40px] leading-[48px] font-extrabold text-primary">
                    {overview.listeningTime?.text || '0h 0m'}
                  </h1>

                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-line">
                    <div>
                      <span className="t-h2 text-[20px] font-bold text-text block">
                        {overview.plays || 0}
                      </span>
                      <span className="t-cap text-[12px] text-muted">Plays</span>
                    </div>
                    <div>
                      <span className="t-h2 text-[20px] font-bold text-text block">
                        {overview.distinct?.songs || 0}
                      </span>
                      <span className="t-cap text-[12px] text-muted">Songs</span>
                    </div>
                    <div>
                      <span className="t-h2 text-[20px] font-bold text-text block">
                        {overview.activeDays || 1}
                      </span>
                      <span className="t-cap text-[12px] text-muted">Active days</span>
                    </div>
                  </div>
                </div>

                {/* Insights Sentences */}
                {dashboard?.insights?.sentences?.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x">
                    {dashboard.insights.sentences.map((sentence: string, idx: number) => (
                      <div
                        key={idx}
                        className="min-w-[calc(100%-32px)] h-[96px] rounded-[28px] bg-surface p-5 border border-line flex items-center gap-3 flex-shrink-0 snap-center"
                      >
                        <Sparkles size={22} className="text-primary flex-shrink-0" />
                        <p className="t-body text-[14px] text-text font-medium leading-snug line-clamp-2">
                          {sentence}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ranked Dimension Sections */}
                {TOP_SECTIONS.map(({ key, title, icon: Icon }) => {
                  const items = dashboard?.top?.[key] || [];
                  if (!Array.isArray(items) || !items.length) return null;

                  return (
                    <section key={key} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Icon size={20} className="text-primary" />
                        <h2 className="t-h2 text-[18px] font-bold text-text">{title}</h2>
                      </div>

                      <div className="bg-surface rounded-[24px] border border-line p-2 divide-y divide-line/20">
                        {items.slice(0, 10).map((it: any, i: number) => {
                          const img = getMediaImage(it);
                          const name = it.name || it.title || 'Unknown';
                          const plays = it.playCount ?? it.count ?? it.plays ?? 0;
                          const listenedText = it.listenedText || (it.listenedMs ? `${Math.round(it.listenedMs / 60000)}m` : '');

                          return (
                            <button
                              key={it.id || it.saavnId || i}
                              onClick={() => {
                                if (it.id && (it.type === 'artist' || key === 'singers')) {
                                  navigate(`/artist/${it.id}`);
                                } else if (it.id && (it.type === 'album' || key === 'movies')) {
                                  navigate(`/album/${it.id}`);
                                }
                              }}
                              className="w-full flex items-center gap-3.5 p-3 hover:bg-surface-2 rounded-[16px] text-left transition-colors"
                            >
                              <span className="w-5 t-num text-[14px] font-bold text-muted text-center flex-shrink-0">
                                {i + 1}
                              </span>

                              <div className="w-11 h-11 rounded-[14px] overflow-hidden bg-surface-2 flex-shrink-0 flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                  <Icon size={20} className="text-muted" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="t-h3 text-[14px] font-bold text-text truncate leading-tight">
                                  {name}
                                </p>
                                <p className="t-cap text-[12px] text-muted truncate mt-0.5">
                                  {plays} plays {listenedText ? `· ${listenedText}` : ''}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
                  <ChartColumn size={32} />
                </div>
                <h2 className="t-h2 text-[20px] font-bold text-text">There's nothing to analyse yet</h2>
                <p className="t-cap text-[13px] text-muted max-w-[280px]">
                  Play a few songs and your listening profile will build itself.
                </p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB CONTENT */}
        {tab === 'history' && (
          <div className="flex flex-col gap-6">
            {loadingHistory ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-[64px] rounded-[16px] bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : errorHistory ? (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <CircleAlert size={40} className="text-danger" />
                <h2 className="t-h2 text-[20px] font-bold text-text">Couldn't load history</h2>
                <Button size="sm" onClick={() => refetchHistory()}>
                  Retry
                </Button>
              </div>
            ) : Object.keys(groupedHistory).length > 0 ? (
              <div className="flex flex-col gap-6">
                {Object.entries(groupedHistory).map(([dateGroup, items]) => (
                  <section key={dateGroup} className="flex flex-col gap-2">
                    <h2 className="t-h2 text-[16px] font-bold text-muted px-1">{dateGroup}</h2>

                    <div className="flex flex-col divide-y divide-line/20 bg-surface rounded-[24px] border border-line overflow-hidden">
                      {items.map((sess: any, idx: number) => {
                        const song = formatPlayerSong(sess.song || sess);
                        const isCompleted = sess.isCompleted;
                        const isSkip = sess.isSkip;
                        const listenedMs = sess.listenedMs || 0;
                        const durationMs = sess.durationMs || song.durationMs || 0;
                        const ratio = durationMs > 0 ? Math.min(1, listenedMs / durationMs) : 0;

                        return (
                          <div key={sess.id || sess._id || idx} className="relative flex flex-col">
                            <div className="flex items-center justify-between pr-3">
                              <div className="flex-1 min-w-0">
                                <SongRow
                                  song={song}
                                  onPlay={() => {
                                    const queueList = items.map((i) => formatPlayerSong(i.song || i));
                                    setQueue(queueList, idx);
                                    navigate('/player');
                                  }}
                                />
                              </div>

                              {/* Status Badge */}
                              <div className="flex items-center gap-1 pl-2 flex-shrink-0">
                                {isCompleted ? (
                                  <div className="flex items-center gap-1 text-success t-micro font-bold bg-success/12 px-2 py-1 rounded-full">
                                    <CheckCircle2 size={12} />
                                    <span>Completed</span>
                                  </div>
                                ) : isSkip ? (
                                  <div className="flex items-center gap-1 text-danger t-micro font-bold bg-danger/12 px-2 py-1 rounded-full">
                                    <XCircle size={12} />
                                    <span>Skipped</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-muted t-micro font-semibold bg-surface-2 px-2 py-1 rounded-full">
                                    <Clock size={12} />
                                    <span>{Math.round(listenedMs / 60000)}m listened</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Completion Ratio Progress Underline */}
                            <div className="w-full h-[2px] bg-line/30 overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${ratio * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {hasNextPage && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    className="w-full mt-2"
                  >
                    Load more history
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
                  <Clock size={32} />
                </div>
                <h2 className="t-h2 text-[20px] font-bold text-text">No listening history yet</h2>
                <p className="t-cap text-[13px] text-muted max-w-[280px]">
                  Play a few songs and your history will show up here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
