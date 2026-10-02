import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/player';
import { Home, Search, Library, BarChart2 } from 'lucide-react';
import { getActiveTab } from '@/navigation/routes';

const tabs = [
  { id: 'home'    as const, label: 'Home',    icon: Home,     path: '/home'    },
  { id: 'search'  as const, label: 'Search',  icon: Search,   path: '/search'  },
  { id: 'library' as const, label: 'Library', icon: Library,  path: '/library' },
  { id: 'stats'   as const, label: 'Stats',   icon: BarChart2,path: '/stats'   },
];

export function BottomNav() {
  const showPlayer = usePlayerStore((s) => s.showPlayer);
  const navigate   = useNavigate();
  const location   = useLocation();

  if (showPlayer) return null;

  const activeTab = getActiveTab(location.pathname, location.state?.from);

  const handleTab = (tab: typeof tabs[0]) => {
    if (location.pathname === tab.path) {
      const el = document.querySelector('.scroll-y');
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(tab.path);
    }
  };

  return (
    <motion.div
      initial={false}
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(18,16,36,0.92)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(40,36,77,0.5)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.28)',
      }}
    >
      <div className="flex items-stretch justify-around w-full max-w-md mx-auto h-[60px]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => handleTab(tab)}
              aria-label={tab.label}
              className="relative flex-1 flex flex-col items-center justify-center gap-[3px] pt-1"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Floating pill indicator slides under the active tab */}
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute top-0 inset-x-3 h-[2px] rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.7 }}
                />
              )}

              {/* Icon */}
              <motion.div
                animate={isActive ? { scale: 1.08 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                <Icon
                  size={21}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{
                    color: isActive ? 'white' : 'var(--color-muted)',
                    filter: isActive
                      ? 'drop-shadow(0 0 8px rgba(255,255,255,0.55))'
                      : 'none',
                    transition: 'color 0.18s ease, filter 0.18s ease',
                  }}
                />
              </motion.div>

              {/* Label */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 800 : 500,
                  letterSpacing: '0.02em',
                  color: isActive ? 'white' : 'var(--color-muted)',
                  transition: 'color 0.18s ease, font-weight 0.18s ease',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
