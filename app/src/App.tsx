import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as CapacitorApp } from '@capacitor/app';
import { ToastContainer } from '@/components/Toast';
import Navigator from '@/navigation/Navigator';
import { useNavigate as _useNavigate, useLocation } from 'react-router-dom';
import { startPlayerEngine } from '@/player/engine';

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
