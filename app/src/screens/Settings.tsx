import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { users } from '@/api/endpoints';
import { pageTransitionVariants, listStaggerVariants } from '@/motion';
import { ChevronLeft, Volume2, Bell, Wifi, Info, Check } from 'lucide-react';

const QUALITY_OPTIONS = [
  { label: 'Low',    sub: '96 kbps',  value: 'low'    },
  { label: 'Normal', sub: '160 kbps', value: 'medium' },
  { label: 'High',   sub: '320 kbps', value: 'high'   },
];

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={`Toggle ${label}`}
      onClick={onToggle}
      className="relative w-12 h-6 rounded-pill transition-colors flex-shrink-0"
      style={{ background: on ? 'var(--color-primary)' : 'rgba(40,36,77,0.8)', transition: 'background 0.2s ease' }}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 rounded-full"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
        animate={{ x: on ? 28 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
      />
    </button>
  );
}

function SettingsGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(40,36,77,0.5)' }}>
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(40,36,77,0.4)' }}>
        <span style={{ color: 'var(--color-primary-soft)' }}>{icon}</span>
        <h2 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h2>
      </div>
      <div className="px-4 py-3 flex flex-col gap-4">{children}</div>
    </div>
  );
}

export default function Settings() {
  const [quality, setQuality] = useState('high');
  const [autoplay, setAutoplay] = useState(true);
  const [crossfade, setCrossfade] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  const savePrefs = async (patch?: object) => {
    try {
      await users.updatePreferences({
        audioQuality: quality,
        autoplay,
        crossfadeSeconds: crossfade ? 3 : 0,
        dataSaver,
        ...patch,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {}
  };

  return (
    <motion.div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg)' }}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4" style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)`, paddingBottom: 12 }}>
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            aria-label="Back"
          >
            <ChevronLeft size={20} style={{ color: 'var(--color-text)' }} />
          </motion.button>
          <h1 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>Settings</h1>
        </div>
        {saved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill"
            style={{ background: 'rgba(45,225,181,0.15)', color: 'var(--color-mint)' }}
          >
            <Check size={13} />
            <span className="text-xs font-bold">Saved</span>
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-y px-5 pb-10 flex flex-col gap-4">
        {/* Audio Quality */}
        <motion.div custom={0} variants={listStaggerVariants} initial="initial" animate="animate">
          <SettingsGroup title="Audio Quality" icon={<Volume2 size={18} />}>
            <div className="flex flex-col gap-2">
              {QUALITY_OPTIONS.map((opt) => {
                const isActive = quality === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setQuality(opt.value); savePrefs({ audioQuality: opt.value }); }}
                    className="flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                    style={{
                      background: isActive ? 'rgba(139,61,255,0.15)' : 'rgba(9,7,20,0.5)',
                      border: `1px solid ${isActive ? 'rgba(139,61,255,0.4)' : 'rgba(40,36,77,0.5)'}`,
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: isActive ? 'var(--color-primary-soft)' : 'var(--color-text)' }}>{opt.label}</p>
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{opt.sub}</p>
                    </div>
                    {isActive && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
                        <Check size={12} color="white" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </SettingsGroup>
        </motion.div>

        {/* Playback */}
        <motion.div custom={1} variants={listStaggerVariants} initial="initial" animate="animate">
          <SettingsGroup title="Playback" icon={<Volume2 size={18} />}>
            {[
              { label: 'Autoplay',   sub: 'Continue playing after queue ends', state: autoplay,   onToggle: () => { setAutoplay((v) => !v); savePrefs({ autoplay: !autoplay }); } },
              { label: 'Crossfade',  sub: '3-second fade between songs',       state: crossfade,  onToggle: () => { setCrossfade((v) => !v); savePrefs({ crossfadeSeconds: crossfade ? 0 : 3 }); } },
              { label: 'Data Saver', sub: 'Lower quality on mobile data',       state: dataSaver,  onToggle: () => { setDataSaver((v) => !v); savePrefs({ dataSaver: !dataSaver }); } },
            ].map(({ label, sub, state, onToggle }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>
                </div>
                <Toggle on={state} onToggle={onToggle} label={label} />
              </div>
            ))}
          </SettingsGroup>
        </motion.div>

        {/* Notifications */}
        <motion.div custom={2} variants={listStaggerVariants} initial="initial" animate="animate">
          <SettingsGroup title="Notifications" icon={<Bell size={18} />}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Push Notifications</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>Required for background playback controls</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if ((window as any).plugins?.OneSignal) {
                    (window as any).plugins.OneSignal.Notifications.requestPermission(true);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(139,61,255,0.15)', color: 'var(--color-primary-soft)', border: '1px solid rgba(139,61,255,0.3)' }}
              >
                Enable
              </motion.button>
            </div>
          </SettingsGroup>
        </motion.div>

        {/* Data Sync */}
        <motion.div custom={3} variants={listStaggerVariants} initial="initial" animate="animate">
          <SettingsGroup title="Wi-Fi Sync" icon={<Wifi size={18} />}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Downloads only happen on Wi-Fi by default to save your mobile data.</p>
          </SettingsGroup>
        </motion.div>

        {/* About */}
        <motion.div custom={4} variants={listStaggerVariants} initial="initial" animate="animate">
          <SettingsGroup title="About" icon={<Info size={18} />}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Vinaraa</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>Version 1.0.0 — Premium music for a private few.</p>
            </div>
          </SettingsGroup>
        </motion.div>
      </div>
    </motion.div>
  );
}
