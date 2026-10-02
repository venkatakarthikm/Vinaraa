import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { pageTransitionVariants } from '@/motion';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6 text-center"
      style={{ background: 'var(--color-bg)' }}
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(139,61,255,0.12)', border: '1px solid rgba(139,61,255,0.2)' }}
      >
        <span className="text-4xl font-black" style={{ color: 'var(--color-primary-soft)' }}>404</span>
      </div>
      <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>Page Not Found</h1>
      <p className="text-sm mb-8 max-w-xs" style={{ color: 'var(--color-muted)' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/home', { replace: true })}
        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold text-sm"
        style={{ background: 'var(--color-primary)', boxShadow: '0 8px 24px rgba(139,61,255,0.3)' }}
      >
        <Home size={16} />
        Go Home
      </motion.button>
    </motion.div>
  );
}
