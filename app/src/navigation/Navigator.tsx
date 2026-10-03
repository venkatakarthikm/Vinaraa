import { Routes, Route, useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import Splash from '@/screens/Splash';
import Welcome from '@/screens/Welcome';
import Login from '@/screens/Login';
import Register from '@/screens/Register';
import ForgotPassword from '@/screens/ForgotPassword';
import ResetPassword from '@/screens/ResetPassword';
import Onboarding from '@/screens/Onboarding';
import Home from '@/screens/Home';
import Search from '@/screens/Search';
import Library from '@/screens/Library';
import Stats from '@/screens/Stats';
import Album from '@/screens/Album';
import Artist from '@/screens/Artist';
import PlaylistPage from '@/screens/PlaylistPage';
import FullPlayer from '@/screens/FullPlayer';
import Profile from '@/screens/Profile';
import Settings from '@/screens/Settings';
import Offline from '@/screens/Offline';
import AdminDashboard from '@/screens/AdminDashboard';
import NotFound from '@/screens/NotFound';
import { BottomNav } from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import { ControlStripSlot } from '@/components/ControlStrip';
import {
  tabTransitionVariants,
  pageTransitionVariants,
} from '@/motion';

const TAB_PATHS = new Set(['/home', '/search', '/library', '/stats']);

function AppShell() {
  const location = useLocation();
  const isTab = TAB_PATHS.has(location.pathname);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={isTab ? tabTransitionVariants : pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
            style={{ willChange: 'opacity, transform' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <ControlStripSlot />
      <MiniPlayer />
      <BottomNav />
    </div>
  );
}

export default function Navigator() {
  const location = useLocation();
  const isAuthRoute = [
    '/',
    '/welcome',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/onboarding',
    '/player',
  ].some((p) => location.pathname === p || location.pathname.startsWith('/player'));

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--c-bg)' }}>
      {isAuthRoute && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={tabTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
            style={{ willChange: 'opacity, transform' }}
          >
            <Routes location={location}>
              <Route path="/" element={<Splash />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/player" element={<FullPlayer />} />
              <Route path="/player/:id" element={<FullPlayer />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      )}

      {!isAuthRoute && (
        <Routes location={location}>
          <Route element={<AppShell />}>
            <Route path="/home" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/album/:id" element={<Album />} />
            <Route path="/artist/:id" element={<Artist />} />
            <Route path="/playlist/:id" element={<PlaylistPage />} />
            <Route path="/list/:kind" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/downloads" element={<Offline />} />
            <Route path="/offline" element={<Offline />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      )}
    </div>
  );
}
