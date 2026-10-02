import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { WifiOff, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Offline() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6 text-center"
      style={{ background: 'var(--color-bg)' }}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      {/* Animated wifi icon */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(154,152,189,0.1)', border: '1px solid rgba(154,152,189,0.15)' }}
      >
        <WifiOff size={40} style={{ color: 'var(--color-muted)' }} />
      </motion.div>

      <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>You're offline</h1>
      <p className="text-sm mb-8 max-w-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        Connect to the internet to stream new songs, or play your downloaded music offline.
      </p>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/library', { replace: true, state: { tab: 'downloads' } })}
        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold text-sm"
        style={{ background: 'var(--color-primary)', boxShadow: '0 8px 24px rgba(139,61,255,0.3)' }}
      >
        <Download size={16} />
        Open Downloads
      </motion.button>
    </motion.div>
  );
}
