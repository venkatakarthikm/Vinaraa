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
      className="fixed bottom-0 left-0 right-0 z-50 px-4 flex justify-center"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 12px)` }}
    >
      <div className="glass rounded-pill px-2 py-2 flex gap-1 shadow-colored max-w-sm w-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab)}
              className="relative flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-pill"
              aria-label={tab.label}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-blob"
                  className="absolute inset-0 bg-primary/20 rounded-pill border border-primary/40"
                  transition={springs.snappy}
                />
              )}
              <motion.div
                animate={{ y: isActive ? -2 : 0 }}
                transition={springs.snappy}
                className="relative z-10 flex items-center gap-2"
              >
                <tab.icon
                  size={20}
                  className={isActive ? 'text-primary-soft' : 'text-muted'}
                />
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-primary-soft text-xs font-semibold whitespace-nowrap overflow-hidden"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
