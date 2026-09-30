import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { auth } from '@/api/endpoints';
import { useNavigate } from 'react-router-dom';
import { Mail, ChevronLeft, CheckCircle } from 'lucide-react';

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
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col min-h-full bg-bg"
      initial="initial" animate="animate" exit="exit"
      variants={pageTransitionVariants}
    >
      <div className="flex items-center px-4 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-surface-2">
          <ChevronLeft size={24} className="text-text" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4">
        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-bold text-text mb-2">Forgot Password?</h1>
              <p className="text-muted mb-8">Enter your email and we'll send a reset link.</p>
              {error && (
                <div className="bg-danger/20 border border-danger/40 text-danger rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                  <input
                    type="email" required
                    className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-4 outline-none border border-border focus:border-primary-soft transition-colors"
                    placeholder="Email Address"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-4 mt-2 shadow-colored disabled:opacity-70">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center pt-12">
              <div className="bg-mint/20 p-6 rounded-full mb-6 border border-mint/40">
                <CheckCircle size={48} className="text-mint" />
              </div>
              <h2 className="text-2xl font-bold text-text mb-3">Check your email</h2>
              <p className="text-muted mb-8 max-w-[280px]">
                We sent a password reset link to <span className="text-text font-semibold">{email}</span>
              </p>
              <button
                onClick={() => navigate('/reset-password')}
                className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-4 shadow-colored">
                Enter Reset Code
              </button>
              <button onClick={() => navigate('/login')} className="mt-4 text-muted text-sm">
                Back to Sign In
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
