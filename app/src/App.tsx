import { useEffect, useRef } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ToastContainer } from '@/components/Toast';
import Navigator from '@/navigation/Navigator';
import { startPlayerEngine } from '@/player/engine';
import { notifications } from '@/api/endpoints';
import { API_BASE } from '@/api/client';
import { getDeviceInfo } from '@/utils/device';
import { VinaraaPlayer } from '@/native/player';
import { useUIStore } from '@/store/ui';
import AmbientBackdrop from '@/components/AmbientBackdrop';
import OneSignal from 'onesignal-cordova-plugin';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createIDBPersister } from '@/utils/persister';

export function setupOneSignal() {
  if (Capacitor.isNativePlatform()) {
    try {
      const os: any =
        typeof (OneSignal as any)?.initialize === 'function'
          ? OneSignal
          : typeof (OneSignal as any)?.default?.initialize === 'function'
          ? (OneSignal as any).default
          : (window as any)?.plugins?.OneSignal;

      if (!os || typeof os.initialize !== 'function') {
        console.warn('OneSignal plugin initialization function not found.');
        return;
      }

      os.initialize("c7594dd5-a376-4104-ac20-56abe4f1bf42");

      const registerToken = (token: string) => {
        if (token) {
          notifications.registerDevice({ deviceId: token, platform: 'android', provider: 'onesignal' }).catch(console.error);
        }
      };

      os.User?.pushSubscription?.addEventListener?.("change", (event: any) => {
        if (event?.current?.optedIn && event?.current?.id) registerToken(event.current.id);
      });

      const token = os.User?.pushSubscription?.id;
      if (token) registerToken(token);
    } catch (err) {
      console.error("OneSignal setup error:", err);
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

const idbPersister = createIDBPersister();

export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: idbPersister }}>
      <BrowserRouter>
        <AmbientBackdrop />
        <ToastContainer />
        <AppWrapper />
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

function AppWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    startPlayerEngine();
    setupOneSignal();
    getDeviceInfo().then(device => {
      VinaraaPlayer.setConfig({ apiBase: API_BASE, deviceId: device.deviceId }).catch(console.error);
    });

    const handleOpenPlayer = () => {
      navigate('/player');
    };
    window.addEventListener('openPlayerIntent', handleOpenPlayer);

    // Register Capacitor backButton listener ONCE (§2.2)
    const listener = CapacitorApp.addListener('backButton', () => {
      const path = locationRef.current;
      const uiState = useUIStore.getState();

      // 1) A bottom sheet is open -> close the top sheet only
      if (uiState.sheets.length > 0) {
        uiState.popSheet();
        return;
      }

      // 2) On /player and lyrics panel or info sheet is open -> close it
      if (path.startsWith('/player')) {
        if (uiState.playerLyricsOpen || uiState.playerInfoOpen) {
          if (uiState.playerLyricsOpen) uiState.setPlayerLyricsOpen(false);
          if (uiState.playerInfoOpen) uiState.setPlayerInfoOpen(false);
          return;
        }
        // 3) On /player otherwise -> minimise (navigate(-1))
        if (window.history.length <= 1) {
          navigate('/home', { replace: true });
        } else {
          navigate(-1);
        }
        return;
      }

      // 4) On any detail page -> navigate(-1)
      if (
        path.startsWith('/album/') ||
        path.startsWith('/artist/') ||
        path.startsWith('/playlist/') ||
        path.startsWith('/profile') ||
        path.startsWith('/settings') ||
        path.startsWith('/downloads') ||
        path.startsWith('/list/')
      ) {
        navigate(-1);
        return;
      }

      // 5) On /search, /library, /stats -> go to /home
      if (path === '/search' || path === '/library' || path === '/stats') {
        navigate('/home');
        return;
      }

      // 6) On /home, /welcome, / -> minimize app
      if (path === '/home' || path === '/welcome' || path === '/') {
        CapacitorApp.minimizeApp();
        return;
      }

      navigate(-1);
    });

    return () => {
      window.removeEventListener('openPlayerIntent', handleOpenPlayer);
      listener.then((l: any) => l.remove());
    };
  }, [navigate]);

  return <Navigator />;
}
