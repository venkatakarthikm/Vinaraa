import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      // Simulate splash screen animation + token check
      await new Promise(r => setTimeout(r, 1200));
      await checkAuth();
      if (useAuthStore.getState().isAuthenticated) {
        navigate('/home', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
    init();
  }, [checkAuth, navigate]);

  return (
    <motion.div
      className="flex h-screen w-full items-center justify-center bg-bg"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      <div className="flex flex-col items-center">
        {/* Simple animated logo proxy */}
        <motion.div
          className="flex items-end gap-1 mb-4 h-12"
        >
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-2 bg-primary rounded-t-full"
              animate={{ height: [12, 48, 12] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
            />
          ))}
        </motion.div>
        <motion.h1
          className="text-text text-3xl font-bold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Vinaraa
        </motion.h1>
      </div>
    </motion.div>
  );
}
