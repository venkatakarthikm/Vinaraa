import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const startTime = Date.now();

    async function init() {
      await checkAuth();
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1400 - elapsed);

      timeoutId = setTimeout(() => {
        const { isAuthenticated, user } = useAuthStore.getState();
        const seenWelcome = localStorage.getItem('vinaraa.seenWelcome');

        if (isAuthenticated) {
          if (user?.onboarding?.completed) {
            navigate('/home', { replace: true });
          } else {
            navigate('/onboarding', { replace: true });
          }
        } else if (!seenWelcome) {
          navigate('/welcome', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      }, remaining);
    }

    init();
    return () => clearTimeout(timeoutId);
  }, [checkAuth, navigate]);

  const barHeights = [24, 48, 64, 36];

  return (
    <div className="relative w-full h-full bg-bg flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient Blob */}
      <div className="absolute w-[90vw] h-[90vw] rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary/15 blur-3xl pointer-events-none" />

      {/* Mark & Wordmark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: [1, 0.92] }}
        transition={{ duration: 1.1, times: [0, 0.7, 1] }}
        className="flex flex-col items-center gap-5 z-10"
      >
        {/* 96x96 Mark */}
        <div className="w-[96px] h-[96px] rounded-[28px] bg-primary flex items-center justify-center gap-[6px] shadow-2xl">
          {barHeights.map((h, i) => (
            <motion.div
              key={i}
              className="w-[10px] bg-on-primary rounded-full"
              initial={{ height: 0 }}
              animate={{ height: `${h}px` }}
              transition={{
                duration: 0.7,
                delay: i * 0.08,
                type: 'spring',
                stiffness: 300,
                damping: 20,
              }}
            />
          ))}
        </div>

        {/* Wordmark */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="t-h1 text-[28px] leading-[36px] font-bold text-text"
        >
          Vinaraa
        </motion.h1>
      </motion.div>
    </div>
  );
}
