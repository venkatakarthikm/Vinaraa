import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="flex flex-col h-screen w-full bg-bg p-6 items-center justify-center text-center"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
      <p className="text-muted mb-8">This page got lost in the music.</p>
      <button
        onClick={() => navigate('/home', { replace: true })}
        className="bg-surface-2 text-text font-bold rounded-pill px-8 py-4 border border-border"
      >
        Go Home
      </button>
    </motion.div>
  );
}
