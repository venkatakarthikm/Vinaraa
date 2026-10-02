import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransitionVariants, fadeVariants } from '@/motion';
import { auth } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDeviceInfo } from '@/utils/device';
import { Mail, Lock, Eye, EyeOff, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';

function InputField({
  icon: Icon, type, placeholder, value, onChange, autoComplete, right,
}: {
  icon: any; type: string; placeholder: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; right?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--color-muted)' }}
      />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-2xl py-4 pl-12 pr-12 text-sm font-medium outline-none"
        style={{
          background: 'rgba(27,24,54,0.8)',
          color: 'var(--color-text)',
          border: '1px solid rgba(40,36,77,0.8)',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(139,61,255,0.6)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'rgba(40,36,77,0.8)'; }}
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const successMsg = (location.state as any)?.message;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const deviceInfo = await getDeviceInfo();
      const res = await auth.login({ email, password, device: deviceInfo });
      await login(res.user, { accessToken: res.tokens.accessToken });
      navigate(!res.user?.onboarding?.completed ? '/onboarding' : '/home', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
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
      {/* Aurora background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(139,61,255,0.18), transparent 70%)' }} />

      {/* Back */}
      <div className="flex items-center px-4" style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)`, paddingBottom: 8 }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/welcome')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          aria-label="Back"
        >
          <ChevronLeft size={20} style={{ color: 'var(--color-text)' }} />
        </motion.button>
      </div>

      <div className="flex-1 px-6 pt-4 pb-10 overflow-y-auto scroll-y">
        <h1 className="text-3xl font-black mb-1" style={{ color: 'var(--color-text)' }}>Welcome back</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>Sign in to continue to Vinaraa</p>

        {/* Success / Error banners */}
        <AnimatePresence>
          {successMsg && (
            <motion.div variants={fadeVariants} initial="initial" animate="animate" exit="exit"
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 text-sm font-medium"
              style={{ background: 'rgba(45,225,181,0.12)', border: '1px solid rgba(45,225,181,0.3)', color: 'var(--color-mint)' }}>
              <CheckCircle size={16} />{successMsg}
            </motion.div>
          )}
          {error && (
            <motion.div variants={fadeVariants} initial="initial" animate="animate" exit="exit"
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 text-sm font-medium"
              style={{ background: 'rgba(255,84,112,0.1)', border: '1px solid rgba(255,84,112,0.3)', color: 'var(--color-danger)' }}>
              <AlertCircle size={16} />{error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <InputField icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} autoComplete="email" />
          <InputField
            icon={Lock}
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            right={
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1" aria-label="Toggle password">
                {showPassword
                  ? <EyeOff size={18} style={{ color: 'var(--color-muted)' }} />
                  : <Eye size={18} style={{ color: 'var(--color-muted)' }} />}
              </button>
            }
          />

          <div className="flex justify-end mt-1">
            <button type="button" onClick={() => navigate('/forgot-password')}
              className="text-sm font-semibold" style={{ color: 'var(--color-primary-soft)' }}>
              Forgot password?
            </button>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="w-full text-white font-black rounded-2xl py-4 mt-1 text-base"
            style={{
              background: loading ? 'rgba(139,61,255,0.5)' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-soft))',
              boxShadow: loading ? 'none' : '0 10px 32px rgba(139,61,255,0.4)',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing in…
              </span>
            ) : 'Sign In'}
          </motion.button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(40,36,77,0.8)' }} />
          <span className="mx-4 text-xs font-bold" style={{ color: 'var(--color-muted)' }}>OR</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(40,36,77,0.8)' }} />
        </div>

        {/* Social (disabled) */}
        <div className="flex gap-3 mb-8">
          {['Google', 'Apple'].map((s) => (
            <button
              key={s}
              disabled
              className="flex-1 relative py-4 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(27,24,54,0.6)', color: 'var(--color-muted)', border: '1px solid rgba(40,36,77,0.6)', opacity: 0.6 }}
            >
              {s}
              <span className="absolute -top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-pill"
                style={{ background: 'var(--color-surface)', color: 'var(--color-muted)', border: '1px solid rgba(40,36,77,0.6)' }}>
                Soon
              </span>
            </button>
          ))}
        </div>

        <p className="text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="font-bold" style={{ color: 'var(--color-primary-soft)' }}>
            Sign Up
          </button>
        </p>
      </div>
    </motion.div>
  );
}
