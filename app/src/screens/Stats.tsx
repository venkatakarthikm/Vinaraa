import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stats } from '@/api/endpoints';
import { Share2, Sparkles, ChartColumn, CircleAlert } from 'lucide-react';
import Page from '@/components/Page';
import Chip from '@/components/Chip';
import { ControlStrip } from '@/components/ControlStrip';
import SongRow from '@/components/SongRow';
import { formatPlayerSong } from '@/utils/song';
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

export default function Stats() {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToast = useUIStore((s) => s.addToast);

  const [range, setRange] = useState('30d');

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: ['stats', 'dashboard', range],
    queryFn: () => stats.dashboard(range),
    staleTime: 2 * 60 * 1000,
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
  const recentSongs = (dashboard?.recentlyPlayed || []).map(formatPlayerSong);

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
        {/* Range Selector Control Strip */}
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

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <div className="h-[140px] rounded-[28px] bg-surface-2 animate-pulse" />
            <div className="h-[96px] rounded-[28px] bg-surface-2 animate-pulse" />
            <div className="h-[160px] rounded-[28px] bg-surface-2 animate-pulse" />
          </div>
        ) : isError ? (
          <div className="py-16 flex flex-col items-center text-center gap-3">
            <CircleAlert size={40} className="text-danger" />
            <h2 className="t-h2 text-[20px] font-bold text-text">Couldn't load stats</h2>
            <Button size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : overview?.plays ? (
          <div className="flex flex-col gap-6">
            {/* Total Time Card */}
            <div className="w-full bg-surface p-6 rounded-[28px] border border-line flex flex-col gap-4">
              <span className="t-cap text-[13px] text-muted">Time listened</span>
              <h1 className="t-display text-[40px] leading-[48px] font-extrabold text-primary">
                {overview.listeningTime?.text || '42h 10m'}
              </h1>

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-line">
                <div>
                  <span className="t-h2 text-[20px] font-bold text-text block">
                    {overview.plays}
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

            {/* Insights Carousel */}
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

            {/* Recently Played */}
            {recentSongs.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="t-h2 text-[20px] font-bold text-text">Recently played</h2>
                <div className="flex flex-col divide-y divide-line/20">
                  {recentSongs.slice(0, 5).map((song: any, idx: number) => (
                    <SongRow
                      key={song.id || idx}
                      song={song}
                      onPlay={() => {
                        setQueue(recentSongs, idx);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center text-center gap-3">
            <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
              <ChartColumn size={32} />
            </div>
            <h2 className="t-h2 text-[20px] font-bold text-text">No listening data yet</h2>
            <p className="t-cap text-[13px] text-muted max-w-[280px]">
              Listen to a few songs and your stats appear here.
            </p>
          </div>
        )}
      </div>
    </Page>
  );
}
