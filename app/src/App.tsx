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
      os.Notifications?.requestPermission?.(true)?.then?.((granted: boolean) => {
        console.log('[OneSignal] notification permission:', granted);
      });

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

const persister = createIDBPersister();

export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <BrowserRouter>
        <AmbientBackdrop />
        <AppWrapper />
        <ToastContainer />
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

    if (Capacitor.isNativePlatform()) {
      VinaraaPlayer.requestPermissions({ notifications: true, media: false })
        .then((st) => console.log('[Permissions]', st))
        .catch((e) => console.warn('[Permissions] request failed', e));
    }

    getDeviceInfo()
      .then((device: any) => device?.deviceId || 'unknown-' + Date.now())
      .catch(() => 'unknown-' + Date.now())
      .then((deviceId: string) => VinaraaPlayer.setConfig({ apiBase: API_BASE, deviceId })
        .catch((e: any) => console.error('[setConfig] failed', e)));

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

      // 2) At a tab root route -> exit app
      if (['/home', '/search', '/library', '/stats'].includes(path)) {
        CapacitorApp.minimizeApp();
        return;
      }

      // 3) At Full Player -> close full player (navigate back)
      if (path === '/player') {
        navigate(-1);
        return;
      }

      // 4) Inside any detail / push route -> navigate(-1)
      navigate(-1);
    });

    return () => {
      window.removeEventListener('openPlayerIntent', handleOpenPlayer);
      listener.then((h) => h.remove());
    };
  }, [navigate]);

  return <Navigator />;
}
