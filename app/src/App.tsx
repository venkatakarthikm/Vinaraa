import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as CapacitorApp } from '@capacitor/app';
import { ToastContainer } from '@/components/Toast';
import Navigator from '@/navigation/Navigator';
import { useNavigate as _useNavigate, useLocation } from 'react-router-dom';
import { startPlayerEngine } from '@/player/engine';
import OneSignal from 'onesignal-cordova-plugin';
import { notifications } from '@/api/endpoints';

export function setupOneSignal() {
  if (typeof window !== 'undefined' && (window as any).cordova) {
    OneSignal.initialize("c7594dd5-a376-4104-ac20-56abe4f1bf42");
    OneSignal.Notifications.requestPermission(true).then((success: boolean) => {
      console.log("Notification permission granted " + success);
    });

    const registerToken = (token: string) => {
      if (token) {
        notifications.registerDevice({ deviceId: token, platform: 'android', provider: 'onesignal' }).catch(console.error);
      }
    };

    OneSignal.User.pushSubscription.addEventListener("change", (event: any) => {
      if (event.current.optedIn) registerToken(event.current.id);
    });

    const token = OneSignal.User.pushSubscription.id;
    if (token) registerToken(token);
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
