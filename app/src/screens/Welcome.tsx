import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import welcomeImg from '@/assets/welcome.jpg';
import Button from '@/components/Button';
import { usePrefsStore } from '@/store/prefs';

const LANGUAGES = [
  'हिन्दी', 'తెలుగు', 'தமிழ்', 'ಕನ್ನಡ', 'മലയാളം', 'বাংলা',
  'मराठी', 'ਪੰਜਾਬੀ', 'ગુજરાતી', 'ଓଡ଼ିଆ', 'भोजपुरी', 'English',
];

export default function Welcome() {
  const navigate = useNavigate();
  const reduceEffects = usePrefsStore((s) => s.reduceEffects);

  const handleGetStarted = () => {
    localStorage.setItem('vinaraa.seenWelcome', 'true');
    navigate('/register');
  };

  const handleLogin = () => {
    localStorage.setItem('vinaraa.seenWelcome', 'true');
    navigate('/login');
  };

  return (
    <div className="relative w-full h-full bg-bg overflow-hidden flex flex-col justify-between select-none">
      {/* Layer 1: Background Image with Ken-Burns effect */}
      <div className="absolute top-0 left-0 right-0 h-[640px] overflow-hidden pointer-events-none">
        <motion.img
          src={welcomeImg}
          alt="Vinaraa Performer"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover object-[58%_18%]"
          animate={
            !reduceEffects
              ? {
                  scale: [1.04, 1.12],
                  x: [0, -10],
                  y: [0, -8],
                }
              : {}
          }
          transition={{
            duration: 16,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />

        {/* Scrims */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent h-[140px]" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 300px, color-mix(in srgb, var(--c-bg) 35%, transparent) 420px, color-mix(in srgb, var(--c-bg) 85%, transparent) 520px, var(--c-bg) 600px)`,
          }}
        />
      </div>

      {/* Layer 2: Content */}
      <div className="relative z-10 flex flex-col h-full justify-between px-5 pb-[calc(var(--sab)+24px)]">
        {/* Brand Row */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 pt-[calc(var(--sat)+16px)]"
        >
          <img
            src="/vinaraa.png"
            alt="Vinaraa Logo"
            className="w-9 h-9 rounded-[12px] object-cover border border-white/20 shadow-md"
          />
          <span
            className="t-h3 text-white font-extrabold text-[20px] tracking-tight"
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}
          >
            Vinaraa
          </span>
        </motion.div>

        {/* Lower Main Content */}
        <div className="flex flex-col mt-auto pt-[340px]">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col"
          >
            <h1 className="t-display text-[36px] leading-[44px] font-extrabold text-text">
              Your sound,
            </h1>
            <h1 className="t-display text-[36px] leading-[44px] font-extrabold text-text">
              your language.
            </h1>
          </motion.div>

          {/* Subline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="t-body text-[15px] text-muted mt-3 max-w-[340px] leading-relaxed"
          >
            Telugu, Tamil, Hindi, and more - hit play on the tracks that feel like home.
          </motion.p>

          {/* Language Ticker */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="relative w-full overflow-hidden my-6 h-[32px] mask-gradient"
          >
            <div
              className={`flex items-center gap-2 whitespace-nowrap ${
                !reduceEffects ? 'animate-ticker' : 'overflow-x-auto'
              }`}
            >
              {[...LANGUAGES, ...LANGUAGES].map((lang, i) => (
                <span
                  key={i}
                  className="h-[32px] px-3.5 rounded-full bg-surface-2 t-cap text-[13px] font-semibold text-text flex items-center justify-center flex-shrink-0"
                >
                  {lang}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75 }}
            className="flex flex-col items-center gap-2"
          >
            <Button size="lg" onClick={handleGetStarted} className="w-full">
              Get started
            </Button>
            <Button variant="ghost" onClick={handleLogin} className="w-full">
              I already have an account
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
