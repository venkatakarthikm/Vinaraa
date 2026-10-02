import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      await checkAuth();
      if (useAuthStore.getState().isAuthenticated) {
        navigate('/home', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
    // Small delay so the animation can play
    const t = setTimeout(init, 900);
    return () => clearTimeout(t);
  }, [checkAuth, navigate]);

  return (
    <div
      className="flex h-dvh w-full items-center justify-center"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,61,255,0.18), transparent 70%)' }} />

      <div className="flex flex-col items-center gap-5 z-10">
        {/* Animated waveform bars */}
        <motion.div
          className="flex items-end gap-[5px]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 0.84, 0.34, 1] }}
          style={{ height: 52 }}
        >
          {[0.5, 0.85, 1, 0.7, 0.9, 0.6, 1].map((h, i) => (
            <motion.div
              key={i}
              className="w-2 rounded-t-full rounded-b-sm"
              style={{ background: `linear-gradient(to top, var(--color-primary), var(--color-primary-soft))`, minHeight: 8 }}
              animate={{ height: [`${h * 52 * 0.4}px`, `${h * 52}px`, `${h * 52 * 0.4}px`] }}
              transition={{
                repeat: Infinity,
                duration: 0.75,
                delay: i * 0.09,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>

        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 0.84, 0.34, 1] }}
          className="flex flex-col items-center"
        >
          <h1
            className="text-4xl font-black tracking-tight"
            style={{ color: 'var(--color-text)', letterSpacing: '-0.04em' }}
          >
            Vinaraa
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="text-xs font-bold uppercase tracking-[0.2em] mt-1"
            style={{ color: 'var(--color-muted)' }}
          >
            Your Music. Your World.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
