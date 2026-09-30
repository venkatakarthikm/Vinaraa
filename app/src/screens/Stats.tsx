import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { stats } from '@/api/endpoints';
import { BarChart2, Clock, Music2, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import MiniPlayer from '@/components/MiniPlayer';

const RANGES = ['24h', '7d', '30d', '90d', '180d', 'all'];

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-surface-2 border border-border rounded-2xl p-4 flex items-center gap-4">
      <div className="bg-primary/20 rounded-xl p-3 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-muted text-xs">{label}</p>
        <p className="text-text font-bold text-lg">{value}</p>
      </div>
    </div>
  );
}

function msToReadable(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Stats() {
  const [range, setRange] = useState('30d');
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    stats.dashboard(range).then((d) => { setDashboard(d); setLoading(false); }).catch(() => setLoading(false));
  }, [range]);

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-text mb-4">Your Stats</h1>
        <div className="flex gap-2 overflow-x-auto scroll-x pb-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-semibold transition-all uppercase ${range === r ? 'bg-primary text-white' : 'bg-surface-2 text-muted border border-border'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y px-5 pb-safe">
        {loading ? (
          <div className="flex flex-col gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="shimmer h-20 rounded-2xl" />)}</div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={range} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-col gap-3 mb-6">
                <StatCard label="Total Listening Time" value={msToReadable(dashboard?.overview?.totalMs || 0)} icon={<Clock size={22} className="text-primary-soft" />} />
                <StatCard label="Songs Played" value={(dashboard?.overview?.songCount || 0).toLocaleString()} icon={<Music2 size={22} className="text-mint" />} />
                <StatCard label="Unique Tracks" value={(dashboard?.overview?.uniqueSongs || 0).toLocaleString()} icon={<TrendingUp size={22} className="text-accent" />} />
              </div>

              {dashboard?.insights?.sentences?.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-text font-bold mb-3">Insights</h2>
                  <div className="flex flex-col gap-3">
                    {dashboard.insights.sentences.map((s: string, i: number) => (
                      <div key={i} className="bg-surface-2 border border-border rounded-2xl p-4">
                        <p className="text-text text-sm">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard?.timeline?.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-text font-bold mb-3">Listening Activity</h2>
                  <div className="bg-surface-2 border border-border rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={dashboard.timeline}>
                        <Bar dataKey="ms" fill="#8B3DFF" radius={[4, 4, 0, 0]} />
                        <XAxis dataKey="date" tick={{ fill: '#9A98BD', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#14142B', border: '1px solid #2A2A4A', borderRadius: 12 }}
                          labelStyle={{ color: '#F4F3FF' }}
                          formatter={(v: any) => [msToReadable(v), 'Listened']}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {dashboard?.topSongs?.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-text font-bold mb-3">Top Songs</h2>
                  {dashboard.topSongs.slice(0, 5).map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-muted text-sm text-right flex-shrink-0">{i + 1}</span>
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-2 flex-shrink-0">
                        {s.image && <img src={s.image} alt={s.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text text-sm font-semibold line-clamp-1">{s.name || s.songName}</p>
                        <p className="text-muted text-xs">{s.artist || s.singerName}</p>
                      </div>
                      <span className="text-mint text-xs font-bold flex-shrink-0">{msToReadable(s.totalMs || 0)}</span>
                    </div>
                  ))}
                </div>
              )}

              {dashboard?.topLanguages?.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-text font-bold mb-3">By Language</h2>
                  <div className="flex flex-col gap-2">
                    {dashboard.topLanguages.slice(0, 5).map((l: any, i: number) => {
                      const pct = dashboard.topLanguages[0]?.totalMs ? (l.totalMs / dashboard.topLanguages[0].totalMs) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-muted text-xs w-16 capitalize flex-shrink-0">{l.language}</span>
                          <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
                            <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} />
                          </div>
                          <span className="text-text text-xs font-semibold w-12 text-right">{msToReadable(l.totalMs)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!dashboard && (
                <div className="text-center py-16">
                  <BarChart2 size={48} className="text-muted mx-auto mb-4" />
                  <p className="text-muted">Listen to songs to see your stats here.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
        <div className="h-4" />
      </div>
      <MiniPlayer />
    </div>
  );
}
