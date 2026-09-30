import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/store/ui';
import { Home, Search, Library, BarChart2 } from 'lucide-react';
import { springs } from '@/motion';
import { AnimatePresence } from 'framer-motion';

const tabs = [
  { id: 'home' as const, label: 'Home', icon: Home, path: '/home' },
  { id: 'search' as const, label: 'Search', icon: Search, path: '/search' },
  { id: 'library' as const, label: 'Library', icon: Library, path: '/library' },
  { id: 'stats' as const, label: 'Stats', icon: BarChart2, path: '/stats' },
];

export function BottomNav() {
  const { activeTab, setActiveTab } = useUIStore();
  const navigate = useNavigate();

  const handleTab = (tab: typeof tabs[0]) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-6 flex justify-center pb-4"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 16px)` }}
    >
      <div className="bg-[#1D1D3A]/80 backdrop-blur-xl border border-white/10 rounded-[24px] px-2 py-1.5 flex justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-[340px]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-[20px]"
              aria-label={tab.label}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-blob"
                  className="absolute inset-0 bg-primary/20 rounded-[20px] shadow-[0_0_15px_rgba(139,61,255,0.3)]"
                  transition={springs.snappy}
                />
              )}
              <motion.div
                animate={{ y: isActive ? -2 : 0 }}
                transition={springs.snappy}
                className="relative z-10 flex flex-col items-center"
              >
                <tab.icon
                  size={isActive ? 22 : 20}
                  className={isActive ? 'text-primary-soft drop-shadow-[0_0_8px_rgba(139,61,255,0.8)]' : 'text-muted'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
