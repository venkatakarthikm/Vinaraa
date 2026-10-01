// Complete Navigator with all routes and bottom nav
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

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
import NotFound from '@/screens/NotFound';
import { BottomNav } from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';

export default function Navigator() {
  const location = useLocation();
  const showNav = !location.pathname.startsWith('/player');

  return (
    <div className="relative w-full h-full bg-bg overflow-hidden flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Splash />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/home" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/album/:id" element={<Album />} />
            <Route path="/artist/:id" element={<Artist />} />
            <Route path="/playlist/:id" element={<PlaylistPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/player" element={<FullPlayer />} />
            <Route path="/player/:id" element={<FullPlayer />} />
            <Route path="/offline" element={<Offline />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </div>

      {showNav && <MiniPlayer />}
      {showNav && <BottomNav />}
    </div>
  );
}
