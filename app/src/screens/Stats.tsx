import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { stats } from '@/api/endpoints';
import { BarChart2, Music2, TrendingUp, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fadeVariants, listStaggerVariants } from '@/motion';

const RANGES = [
  { label: '24h', value: '24h' },
  { label: '7D',  value: '7d'  },
  { label: '30D', value: '30d' },
  { label: '3M',  value: '90d' },
  { label: '6M',  value: '180d'},
  { label: 'All', value: 'all' },
];

function msToReadable(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function HeroMetric({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <motion.p
        className="text-6xl font-black mb-1"
        style={{ color: 'var(--color-text)', lineHeight: 1 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        {value}
      </motion.p>
      <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary-soft)' }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{sub}</p>}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3 flex-1 min-w-0"
      style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(40,36,77,0.5)' }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-muted)' }}>{label}</p>
        <p className="text-lg font-black truncate" style={{ color: 'var(--color-text)' }}>{value}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--color-surface)', border: '1px solid rgba(139,61,255,0.4)', color: 'var(--color-text)' }}>
      {msToReadable(payload[0]?.value)}
    </div>
  );
};

export default function Stats() {
  const [range, setRange] = useState('30d');

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: ['stats', 'dashboard', range],
    queryFn: () => stats.dashboard(range),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const hasData = dashboard && dashboard?.overview?.plays > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-5"
        style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)`, paddingBottom: 12 }}
      >
        <h1 className="text-2xl font-black mb-4" style={{ color: 'var(--color-text)' }}>Your Stats</h1>

        {/* Range Selector */}
        <div className="flex gap-1.5 overflow-x-auto scroll-x">
          {RANGES.map((r) => (
            <motion.button
              key={r.value}
              onClick={() => setRange(r.value)}
              whileTap={{ scale: 0.93 }}
              className="relative flex-shrink-0 px-4 py-2 rounded-pill text-xs font-bold transition-all"
              style={
                range === r.value
                  ? { background: 'var(--color-primary)', color: 'white' }
                  : { background: 'rgba(27,24,54,0.8)', color: 'var(--color-muted)', border: '1px solid rgba(40,36,77,0.7)' }
              }
            >
              {r.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-y pb-safe px-5">
        {isLoading ? (
          <div className="flex flex-col gap-3 mt-4">
            <div className="shimmer h-36 rounded-2xl" />
            <div className="flex gap-3">
              <div className="shimmer h-20 rounded-2xl flex-1" />
              <div className="shimmer h-20 rounded-2xl flex-1" />
            </div>
            <div className="shimmer h-48 rounded-2xl" />
            <div className="shimmer h-6 w-28 rounded" />
            {[1,2,3].map(i => <div key={i} className="shimmer h-16 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,84,112,0.12)' }}>
              <BarChart2 size={36} className="text-danger" />
            </div>
            <p className="font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>Couldn't load statistics</p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>Check your connection and try again</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-bold"
              style={{ background: 'var(--color-primary)' }}
            >
              <RefreshCw size={15} /> Try Again
            </button>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(139,61,255,0.12)' }}>
              <BarChart2 size={36} style={{ color: 'var(--color-primary-soft)' }} />
            </div>
            <p className="font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>No activity yet</p>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Listen to songs to see your stats here</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={range} variants={fadeVariants} initial="initial" animate="animate" exit="exit">

              {/* Hero metric */}
              <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, rgba(139,61,255,0.2), rgba(255,61,142,0.12))', border: '1px solid rgba(139,61,255,0.25)' }}>
                <HeroMetric
                  value={dashboard?.overview?.listeningTime?.text || msToReadable(dashboard?.overview?.listeningTime?.ms || 0)}
                  label="Total Listening Time"
                  sub={`${(dashboard?.overview?.plays || 0).toLocaleString()} plays · ${(dashboard?.overview?.distinct?.songs || 0).toLocaleString()} unique tracks`}
                />
              </div>

              {/* Stat cards row */}
              <div className="flex gap-3 mb-4">
                <StatCard
                  label="Songs Played"
                  value={(dashboard?.overview?.plays || 0).toLocaleString()}
                  icon={<Music2 size={20} style={{ color: 'var(--color-mint)' }} />}
                  color="var(--color-mint)"
                />
                <StatCard
                  label="Unique Tracks"
                  value={(dashboard?.overview?.distinct?.songs || 0).toLocaleString()}
                  icon={<TrendingUp size={20} style={{ color: 'var(--color-accent)' }} />}
                  color="var(--color-accent)"
                />
              </div>

              {/* Timeline chart */}
              {dashboard?.timeline?.points?.length > 0 && (
                <motion.div
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  className="mb-4 rounded-2xl p-4"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(40,36,77,0.5)' }}
                >
                  <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>Listening Activity</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={dashboard.timeline.points} barCategoryGap="25%">
                      <Bar dataKey="listenedMs" radius={[5, 5, 0, 0]}>
                        {dashboard.timeline.points.map((_: any, i: number) => (
                          <Cell key={i} fill={`rgba(139,61,255,${0.5 + (i / dashboard.timeline.points.length) * 0.5})`} />
                        ))}
                      </Bar>
                      <XAxis
                        dataKey="day"
                        tick={{ fill: '#9A98BD', fontSize: 9, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,61,255,0.08)' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Insights */}
              {dashboard?.insights?.sentences?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>Insights</p>
                  <div className="flex flex-col gap-2">
                    {dashboard.insights.sentences.map((s: string, i: number) => (
                      <motion.div
                        key={i}
                        custom={i}
                        variants={listStaggerVariants}
                        initial="initial"
                        animate="animate"
                        className="rounded-xl p-3.5"
                        style={{ background: 'rgba(139,61,255,0.08)', border: '1px solid rgba(139,61,255,0.15)' }}
                      >
                        <p className="text-sm" style={{ color: 'var(--color-text)' }}>{s}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Songs */}
              {dashboard?.top?.songs?.items?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>Top Songs</p>
                  {dashboard.top.songs.items.slice(0, 5).map((s: any, i: number) => (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={listStaggerVariants}
                      initial="initial"
                      animate="animate"
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span className="w-5 text-xs text-right flex-shrink-0 font-bold" style={{ color: 'var(--color-muted)' }}>{i + 1}</span>
                      <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--color-surface-2)' }}>
                        {s.image && <img src={s.image} alt={s.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>{s.name}</p>
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-muted)' }}>{s.subtitle}</p>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--color-mint)' }}>
                        {s.listenedText || msToReadable(s.listenedMs || 0)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* By Language */}
              {dashboard?.top?.languages?.items?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>By Language</p>
                  <div className="flex flex-col gap-3">
                    {dashboard.top.languages.items.slice(0, 5).map((l: any, i: number) => {
                      const maxMs = dashboard.top.languages.items[0]?.listenedMs || 1;
                      const pct = (l.listenedMs / maxMs) * 100;
                      const colors = ['#8B3DFF', '#FF3D8E', '#2DE1B5', '#FFC247', '#B57BFF'];
                      return (
                        <motion.div
                          key={i}
                          custom={i}
                          variants={listStaggerVariants}
                          initial="initial"
                          animate="animate"
                          className="flex items-center gap-3"
                        >
                          <span className="text-xs font-semibold capitalize flex-shrink-0 w-16 truncate" style={{ color: 'var(--color-muted)' }}>{l.name}</span>
                          <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(40,36,77,0.8)' }}>
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: colors[i] }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 0.84, 0.34, 1] }}
                            />
                          </div>
                          <span className="text-xs font-bold w-12 text-right flex-shrink-0" style={{ color: 'var(--color-text)' }}>
                            {l.listenedText || msToReadable(l.listenedMs)}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="h-4" />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
