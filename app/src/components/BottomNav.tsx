import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Library, BarChart2 } from 'lucide-react';
import { getActiveTab } from '@/navigation/routes';

const tabs = [
  { id: 'home'    as const, label: 'Home',    icon: Home,     path: '/home'    },
  { id: 'search'  as const, label: 'Search',  icon: Search,   path: '/search'  },
  { id: 'library' as const, label: 'Library', icon: Library,  path: '/library' },
  { id: 'stats'   as const, label: 'Stats',   icon: BarChart2,path: '/stats'   },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = getActiveTab(location.pathname, location.state?.from);

  const handleTab = (tab: typeof tabs[0]) => {
    if (location.pathname === tab.path) {
      const el = document.querySelector('.overflow-y-auto');
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(tab.path);
    }
  };

  return (
    <div
      className="fixed bottom-[calc(var(--sab)+8px)] left-[12px] right-[12px] z-40 h-[64px] rounded-[28px] bg-surface border border-line surface-glass shadow-lg flex items-center justify-around px-2"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => handleTab(tab)}
            aria-label={tab.label}
            className="relative flex-1 h-[64px] flex items-center justify-center"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isActive ? (
              <motion.div
                layoutId="dock-pill"
                className="h-[44px] px-[14px] rounded-[22px] bg-primary flex items-center gap-2 text-on-primary font-semibold text-xs"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <Icon size={22} className="text-on-primary" />
                <span className="t-micro whitespace-nowrap">{tab.label}</span>
              </motion.div>
            ) : (
              <Icon size={24} className="text-muted" />
            )}
          </button>
        );
      })}
    </div>
  );
}
