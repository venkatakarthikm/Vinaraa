import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { Music2, Mic2, Headphones, Play } from 'lucide-react';

const slides = [
  {
    headline: 'Indian cinema, your soundtrack.',
    accent: 'cinema',
    icon: <Headphones size={64} className="text-primary-soft" />,
    sub: 'Stream every Bollywood, Kollywood and Tollywood hit.',
  },
  {
    headline: 'Personalised to your taste.',
    accent: 'Personalised',
    icon: <Music2 size={64} className="text-mint" />,
    sub: 'The more you listen, the smarter Vinaraa gets.',
  },
  {
    headline: 'Follow your favourite singers.',
    accent: 'favourite',
    icon: <Mic2 size={64} className="text-accent" />,
    sub: 'From Arijit to AR Rahman — curated recommendations.',
  },
];

export default function Welcome() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const slide = slides[idx];

  return (
    <motion.div
      className="flex flex-col h-full bg-bg"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      {/* Progress dots */}
      <div className="flex gap-2 justify-center pt-16 pb-8">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-pill transition-all duration-300 ${i === idx ? 'w-8 bg-primary' : 'w-4 bg-surface-2'}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center"
        >
          <div className="bg-surface-2 rounded-full p-8 mb-8 border border-border">
            {slide.icon}
          </div>
          <h1 className="text-3xl font-bold text-text mb-4 leading-tight">
            {slide.headline}
          </h1>
          <p className="text-muted text-base leading-relaxed">{slide.sub}</p>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="px-6 pb-12 flex flex-col gap-3">
        {idx < slides.length - 1 ? (
          <button
            onClick={() => setIdx((i) => i + 1)}
            className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold py-4 rounded-pill shadow-colored flex items-center justify-center gap-2"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => navigate('/register')}
            className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold py-4 rounded-pill shadow-colored flex items-center justify-center gap-2"
          >
            <Play size={20} fill="white" />
            Let's Get Started
          </button>
        )}
        <button
          onClick={() => navigate('/login')}
          className="text-muted text-sm text-center py-2"
        >
          Already have an account? <span className="text-primary-soft font-semibold">Sign In</span>
        </button>
      </div>
    </motion.div>
  );
}
