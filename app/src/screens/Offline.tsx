import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Offline() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="flex flex-col h-screen w-full bg-bg p-6 items-center justify-center text-center"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      <div className="bg-surface-2 p-6 rounded-full mb-6">
        <WifiOff size={48} className="text-muted" />
      </div>
      <h1 className="text-3xl font-bold text-text mb-4">You're offline</h1>
      <p className="text-muted mb-8 max-w-[260px]">
        Connect to the internet to listen to new songs, or play your downloaded music.
      </p>
      <button
        onClick={() => navigate('/downloads', { replace: true })}
        className="bg-primary text-white font-bold rounded-pill px-8 py-4 shadow-colored"
      >
        Open Downloads
      </button>
    </motion.div>
  );
}
