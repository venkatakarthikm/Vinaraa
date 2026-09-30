import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { users } from '@/api/endpoints';
import { pageTransitionVariants } from '@/motion';
import { ChevronLeft, Volume2, Bell, Wifi, Info } from 'lucide-react';

const QUALITY_OPTIONS = [
  { label: 'Low (96 kbps)', value: 'low' },
  { label: 'Normal (160 kbps)', value: 'medium' },
  { label: 'High (320 kbps)', value: 'high' },
];

export default function Settings() {
  const [quality, setQuality] = useState('high');
  const [autoplay, setAutoplay] = useState(true);
  const [crossfade, setCrossfade] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const navigate = useNavigate();

  const savePrefs = async () => {
    try {
      await users.updatePreferences({ audioQuality: quality, autoplay, crossfade, dataSaver });
    } catch (_e) {}
  };

  return (
    <motion.div className="flex flex-col h-full bg-bg"
      initial="initial" animate="animate" exit="exit" variants={pageTransitionVariants}>
      <div className="flex items-center px-4 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-surface-2" aria-label="Back">
          <ChevronLeft size={24} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text ml-3">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y px-5 pb-10 flex flex-col gap-4">
        <div className="bg-surface-2 border border-border rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <Volume2 size={20} className="text-primary-soft" />
            <h2 className="text-text font-semibold">Audio Quality</h2>
          </div>
          <div className="flex flex-col gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => { setQuality(opt.value); savePrefs(); }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${quality === opt.value ? 'bg-primary/20 border border-primary/40' : 'bg-bg border border-border'}`}>
                <span className={quality === opt.value ? 'text-primary-soft font-semibold' : 'text-text'}>{opt.label}</span>
                {quality === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-2 border border-border rounded-2xl p-4 flex flex-col gap-4">
          {[
            { label: 'Autoplay', icon: <Bell size={18} />, state: autoplay, toggle: () => { setAutoplay((v) => !v); savePrefs(); } },
            { label: 'Crossfade', icon: <Volume2 size={18} />, state: crossfade, toggle: () => { setCrossfade((v) => !v); savePrefs(); } },
            { label: 'Data Saver', icon: <Wifi size={18} />, state: dataSaver, toggle: () => { setDataSaver((v) => !v); savePrefs(); } },
          ].map(({ label, icon, state, toggle }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-muted">{icon}</span>
                <span className="text-text font-medium">{label}</span>
              </div>
              <button onClick={toggle} aria-label={`Toggle ${label}`}
                className={`w-12 h-6 rounded-pill transition-colors relative ${state ? 'bg-primary' : 'bg-border'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${state ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-surface-2 border border-border rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Info size={20} className="text-muted" />
            <h2 className="text-text font-semibold">About</h2>
          </div>
          <p className="text-muted text-sm">Vinaraa v1.0.0</p>
          <p className="text-muted text-xs mt-1">Premium music for a private few.</p>
        </div>
      </div>
    </motion.div>
  );
}
