import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, Download } from 'lucide-react';
import Button from '@/components/Button';
import { useUIStore } from '@/store/ui';

export default function Offline() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      addToast('Back online', 'success');
      navigate(-1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [navigate, addToast]);

  const handleTryAgain = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (navigator.onLine) {
        addToast('Back online', 'success');
        navigate(-1);
      } else {
        addToast('Still offline', 'info');
      }
    }, 1000);
  };

  return (
    <div className="relative w-full h-full bg-bg flex flex-col items-center justify-center p-6 text-center select-none">
      {/* 72 Circle + WifiOff */}
      <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted mb-4 shadow-sm">
        <WifiOff size={32} />
      </div>

      <h1 className="t-h1 text-[28px] font-bold text-text mb-2">You're offline</h1>
      <p className="t-body text-[15px] text-muted max-w-[280px] leading-relaxed mb-8">
        Your downloads are still here. Everything else needs internet.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        <Button
          size="lg"
          onClick={() => navigate('/library', { state: { tab: 'downloads' } })}
          className="w-full flex items-center justify-center gap-2"
        >
          <Download size={18} />
          <span>Open downloads</span>
        </Button>

        <Button
          variant="secondary"
          size="lg"
          loading={checking}
          onClick={handleTryAgain}
          className="w-full"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
