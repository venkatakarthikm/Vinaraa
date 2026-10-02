import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ToastContainer } from '@/components/Toast';
import Navigator from '@/navigation/Navigator';
import { useNavigate, useLocation } from 'react-router-dom';
import { startPlayerEngine } from '@/player/engine';
import { usePlayerStore } from '@/store/player';
import { notifications } from '@/api/endpoints';
import { API_BASE } from '@/api/client';
import { getDeviceInfo } from '@/utils/device';
import { VinaraaPlayer } from '@/native/player';
import OneSignal from 'onesignal-cordova-plugin';

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

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createIDBPersister } from '@/utils/persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const idbPersister = createIDBPersister();

export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: idbPersister }}>
      <BrowserRouter>
        <ToastContainer />
        <AppWrapper />
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

const MAIN_TABS = ['/home', '/search', '/library', '/stats'];

function AppWrapper() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    startPlayerEngine();
    setupOneSignal();
    getDeviceInfo().then(device => {
      VinaraaPlayer.setConfig({ apiBase: API_BASE, deviceId: device.deviceId }).catch(console.error);
    });

    const handleOpenPlayer = () => {
      usePlayerStore.getState().setShowPlayer(true);
      navigate('/player');
    };
    window.addEventListener('openPlayerIntent', handleOpenPlayer);

    const listener = CapacitorApp.addListener('backButton', (_: any) => {
      const path = location.pathname;
      if (MAIN_TABS.includes(path) || path === '/' || path === '/welcome') {
        CapacitorApp.minimizeApp();
        return;
      }
      window.history.back();
    });

    return () => {
      window.removeEventListener('openPlayerIntent', handleOpenPlayer);
      listener.then((l: any) => l.remove());
    };
  }, [location, navigate]);

  return <Navigator />;
}
