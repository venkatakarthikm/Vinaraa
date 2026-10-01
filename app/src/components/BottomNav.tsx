import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/store/ui';
import { usePlayerStore } from '@/store/player';
import { Home, Search, Library, BarChart2 } from 'lucide-react';
import { springs } from '@/motion';

const tabs = [
  { id: 'home' as const, label: 'Home', icon: Home, path: '/home' },
  { id: 'search' as const, label: 'Search', icon: Search, path: '/search' },
  { id: 'library' as const, label: 'Library', icon: Library, path: '/library' },
  { id: 'stats' as const, label: 'Stats', icon: BarChart2, path: '/stats' },
];

export function BottomNav() {
  const { activeTab, setActiveTab } = useUIStore();
  const { showPlayer } = usePlayerStore();
  const navigate = useNavigate();

  if (showPlayer) return null;

  const handleTab = (tab: typeof tabs[0]) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 border-t border-border/60 backdrop-blur-2xl px-4 pt-2 pb-safe shadow-2xl"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 8px)` }}
    >
      <div className="flex items-center justify-around w-full max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all"
              aria-label={tab.label}
            >
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute top-0 w-8 h-1 bg-primary rounded-full shadow-[0_0_12px_#8B3DFF]"
                  transition={springs.snappy}
                />
              )}
              <tab.icon
                size={20}
                className={isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-muted'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-bold tracking-tight transition-colors ${
                  isActive ? 'text-white font-black' : 'text-muted'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
