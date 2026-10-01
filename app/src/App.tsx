import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ToastContainer } from '@/components/Toast';
import Navigator from '@/navigation/Navigator';
import { useNavigate as _useNavigate, useLocation } from 'react-router-dom';
import { startPlayerEngine } from '@/player/engine';
import OneSignal from 'onesignal-cordova-plugin';
import { notifications } from '@/api/endpoints';

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
      os.Notifications?.requestPermission?.(true)?.then?.((success: boolean) => {
        console.log("Notification permission granted " + success);
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
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastContainer />
        <AppWrapper />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const MAIN_TABS = ['/home', '/search', '/library', '/stats'];

function AppWrapper() {
  const location = useLocation();

  useEffect(() => {
    startPlayerEngine();
    setupOneSignal();
    
    const listener = CapacitorApp.addListener('backButton', (_: any) => {
      const path = location.pathname;
      if (MAIN_TABS.includes(path) || path === '/' || path === '/welcome') {
        CapacitorApp.minimizeApp();
        return;
      }
      window.history.back();
    });
    return () => { listener.then((l: any) => l.remove()); };
  }, [location]);

  return <Navigator />;
}
