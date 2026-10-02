import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransitionVariants, fadeVariants } from '@/motion';
import { auth } from '@/api/endpoints';
import { useNavigate } from 'react-router-dom';
import { Mail, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col min-h-full"
      style={{ background: 'var(--color-bg)' }}
      initial="initial" animate="animate" exit="exit"
      variants={pageTransitionVariants}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 35% at 50% 0%, rgba(139,61,255,0.14), transparent 70%)' }} />

      {/* Back */}
      <div className="flex items-center px-4" style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)`, paddingBottom: 8 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Back">
          <ChevronLeft size={20} style={{ color: 'var(--color-text)' }} />
        </motion.button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-6">
        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div key="form" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
              <h1 className="text-3xl font-black mb-1" style={{ color: 'var(--color-text)' }}>Forgot Password?</h1>
              <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>Enter your email and we'll send you a reset link</p>

              <AnimatePresence>
                {error && (
                  <motion.div variants={fadeVariants} initial="initial" animate="animate" exit="exit"
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 text-sm font-medium"
                    style={{ background: 'rgba(255,84,112,0.1)', border: '1px solid rgba(255,84,112,0.3)', color: 'var(--color-danger)' }}>
                    <AlertCircle size={16} />{error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--color-muted)' }} />
                  <input
                    type="email" required placeholder="Email address" value={email}
                    onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                    className="w-full rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none"
                    style={{ background: 'rgba(27,24,54,0.8)', color: 'var(--color-text)', border: '1px solid rgba(40,36,77,0.8)', transition: 'border-color 0.2s' }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(139,61,255,0.6)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(40,36,77,0.8)'; }}
                  />
                </div>
                <motion.button
                  type="submit" disabled={loading}
                  whileTap={!loading ? { scale: 0.97 } : {}}
                  className="w-full text-white font-black rounded-2xl py-4 text-base"
                  style={{
                    background: loading ? 'rgba(139,61,255,0.5)' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-soft))',
                    boxShadow: loading ? 'none' : '0 10px 32px rgba(139,61,255,0.35)',
                    transition: 'background 0.2s, box-shadow 0.2s',
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending…
                    </span>
                  ) : 'Send Reset Link'}
                </motion.button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="sent"
              variants={fadeVariants} initial="initial" animate="animate"
              className="flex flex-col items-center text-center pt-8"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
                style={{ background: 'rgba(45,225,181,0.15)', border: '1px solid rgba(45,225,181,0.3)' }}
              >
                <CheckCircle size={48} style={{ color: 'var(--color-mint)' }} />
              </motion.div>
              <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>Check your email</h2>
              <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>We sent a reset link to</p>
              <p className="text-sm font-bold mb-8" style={{ color: 'var(--color-text)' }}>{email}</p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/reset-password')}
                className="w-full text-white font-black rounded-2xl py-4 mb-4 text-base"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-soft))', boxShadow: '0 10px 32px rgba(139,61,255,0.35)' }}
              >
                Enter Reset Code
              </motion.button>
              <button onClick={() => navigate('/login')} className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
                Back to Sign In
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
