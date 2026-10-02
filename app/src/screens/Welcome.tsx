import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransitionVariants, fadeVariants } from '@/motion';
import { Headphones, Music2, Mic2, ArrowRight } from 'lucide-react';

const slides = [
  {
    headline: ['Indian cinema,', 'your soundtrack.'],
    icon: Headphones,
    iconColor: '#B57BFF',
    iconBg:    'rgba(139,61,255,0.15)',
    sub: 'Stream every Bollywood, Kollywood and Tollywood hit — all in one place.',
    accent: '#8B3DFF',
  },
  {
    headline: ['Personalised', 'to your taste.'],
    icon: Music2,
    iconColor: '#2DE1B5',
    iconBg:    'rgba(45,225,181,0.12)',
    sub: 'The more you listen, the smarter Vinaraa gets at finding what you love.',
    accent: '#2DE1B5',
  },
  {
    headline: ['Your favourite', 'singers, curated.'],
    icon: Mic2,
    iconColor: '#FF3D8E',
    iconBg:    'rgba(255,61,142,0.12)',
    sub: 'From Arijit to AR Rahman — handpicked recommendations just for you.',
    accent: '#FF3D8E',
  },
];

export default function Welcome() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const slide = slides[idx];
  const Icon = slide.icon;
  const isLast = idx === slides.length - 1;

  return (
    <motion.div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg)' }}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      {/* Aurora glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${slide.accent}22, transparent 70%)`, transition: 'background 0.6s ease' }}
      />

      {/* Skip */}
      <div className="flex justify-end px-5" style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)` }}>
        <button
          onClick={() => navigate('/register')}
          className="text-xs font-semibold px-3 py-1.5 rounded-pill"
          style={{ color: 'var(--color-muted)', background: 'rgba(255,255,255,0.06)' }}
        >
          Skip
        </button>
      </div>

      {/* Slide dots */}
      <div className="flex gap-1.5 justify-center mt-6">
        {slides.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === idx ? 28 : 8, background: i === idx ? slide.accent : 'rgba(154,152,189,0.3)' }}
            transition={{ duration: 0.3 }}
            className="h-1.5 rounded-pill"
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center"
          >
            {/* Icon */}
            <motion.div
              className="w-28 h-28 rounded-3xl flex items-center justify-center mb-8"
              style={{ background: slide.iconBg, border: `1px solid ${slide.accent}33` }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
            >
              <Icon size={52} style={{ color: slide.iconColor }} />
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl font-black leading-tight mb-4" style={{ color: 'var(--color-text)' }}>
              {slide.headline[0]}<br />
              <span style={{ color: slide.accent }}>{slide.headline[1]}</span>
            </h1>

            {/* Sub */}
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--color-muted)' }}>{slide.sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="px-6 pb-10 flex flex-col gap-3">
        {!isLast ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIdx((i) => i + 1)}
            className="w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base"
            style={{
              background: `linear-gradient(135deg, ${slide.accent}, ${slide.accent}99)`,
              boxShadow: `0 10px 32px ${slide.accent}44`,
            }}
          >
            Next <ArrowRight size={18} />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/register')}
            className="w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              boxShadow: '0 10px 32px rgba(139,61,255,0.4)',
            }}
          >
            Let's Get Started <ArrowRight size={18} />
          </motion.button>
        )}
        <button
          onClick={() => navigate('/login')}
          className="text-sm text-center py-2"
          style={{ color: 'var(--color-muted)' }}
        >
          Already have an account?{' '}
          <span className="font-bold" style={{ color: 'var(--color-primary-soft)' }}>Sign In</span>
        </button>
      </div>
    </motion.div>
  );
}
