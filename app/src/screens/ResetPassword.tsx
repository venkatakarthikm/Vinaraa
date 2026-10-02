import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransitionVariants, fadeVariants } from '@/motion';
import { auth } from '@/api/endpoints';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Hash, ChevronLeft, Mail, AlertCircle } from 'lucide-react';

function Field({ icon: Icon, type, placeholder, value, onChange, minLength, right }: {
  icon: any; type: string; placeholder: string; value: string;
  onChange: (v: string) => void; minLength?: number; right?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--color-muted)' }} />
      <input
        type={type} placeholder={placeholder} value={value} required minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl py-4 pl-12 pr-12 text-sm font-medium outline-none"
        style={{ background: 'rgba(27,24,54,0.8)', color: 'var(--color-text)', border: '1px solid rgba(40,36,77,0.8)', transition: 'border-color 0.2s' }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(139,61,255,0.6)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'rgba(40,36,77,0.8)'; }}
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await auth.resetPassword({ token, email, newPassword });
      navigate('/login', { replace: true, state: { message: 'Password reset successfully! Sign in with your new password.' } });
    } catch (err: any) {
      setError(err.message || 'Reset failed. The token may have expired.');
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

      <div className="flex items-center px-4" style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)`, paddingBottom: 8 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Back">
          <ChevronLeft size={20} style={{ color: 'var(--color-text)' }} />
        </motion.button>
      </div>

      <div className="flex-1 px-6 pt-4 pb-10 overflow-y-auto scroll-y">
        <h1 className="text-3xl font-black mb-1" style={{ color: 'var(--color-text)' }}>Reset Password</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>Enter the reset token sent to your email</p>

        <AnimatePresence>
          {error && (
            <motion.div variants={fadeVariants} initial="initial" animate="animate" exit="exit"
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 text-sm font-medium"
              style={{ background: 'rgba(255,84,112,0.1)', border: '1px solid rgba(255,84,112,0.3)', color: 'var(--color-danger)' }}>
              <AlertCircle size={16} />{error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleReset} className="flex flex-col gap-3">
          <Field icon={Mail} type="email" placeholder="Your email address"
            value={email} onChange={setEmail} />
          <Field icon={Hash} type="text" placeholder="Reset token (from email)"
            value={token} onChange={setToken} />
          <Field
            icon={Lock}
            type={showPass ? 'text' : 'password'}
            placeholder="New password"
            value={newPassword}
            onChange={setNewPassword}
            minLength={8}
            right={
              <button type="button" onClick={() => setShowPass((v) => !v)} className="p-1" aria-label="Toggle password">
                {showPass
                  ? <EyeOff size={18} style={{ color: 'var(--color-muted)' }} />
                  : <Eye size={18} style={{ color: 'var(--color-muted)' }} />}
              </button>
            }
          />

          <motion.button
            type="submit" disabled={loading}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="w-full text-white font-black rounded-2xl py-4 mt-1 text-base"
            style={{
              background: loading ? 'rgba(139,61,255,0.5)' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-soft))',
              boxShadow: loading ? 'none' : '0 10px 32px rgba(139,61,255,0.35)',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Resetting…
              </span>
            ) : 'Reset Password'}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
}
