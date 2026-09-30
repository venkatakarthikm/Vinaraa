import { useState } from 'react';
import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { auth } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDeviceInfo } from '@/utils/device';
import { Mail, Lock, Eye, EyeOff, ChevronLeft } from 'lucide-react';

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
      const res = await auth.login({
        email,
        password,
        device: deviceInfo,
      });
      await login(res.user, { accessToken: res.accessToken, refreshToken: res.refreshToken });
      if (!res.user?.onboarding?.completed) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
        <button onClick={() => navigate('/welcome')} className="p-2 rounded-full bg-surface-2">
          <ChevronLeft size={24} className="text-text" />
        </button>
      </div>

      <div className="flex-1 px-6 pt-2 pb-8 overflow-y-auto scroll-y">
        <h1 className="text-3xl font-bold text-text mb-2">Welcome Back</h1>
        <p className="text-muted mb-8">Sign in to continue to Vinaraa.</p>

        {successMsg && (
          <div className="bg-mint/20 border border-mint/40 text-mint rounded-xl px-4 py-3 mb-4 text-sm">{successMsg}</div>
        )}
        {error && (
          <div className="bg-danger/20 border border-danger/40 text-danger rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input type="email" required autoComplete="email"
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-4 outline-none border border-border focus:border-primary-soft transition-colors"
              placeholder="Email Address"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-12 outline-none border border-border focus:border-primary-soft transition-colors"
              placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => navigate('/forgot-password')} className="text-primary-soft text-sm font-medium">
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-4 mt-2 shadow-colored disabled:opacity-70">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="mx-4 text-muted text-sm">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-3">
          {['Google', 'Apple'].map((s) => (
            <button key={s} disabled className="flex-1 py-4 bg-surface-2 border border-border rounded-2xl text-muted opacity-50 relative text-sm font-semibold">
              {s}
              <span className="absolute -top-2 right-2 text-[9px] bg-surface text-muted px-1.5 py-0.5 rounded-pill border border-border">Soon</span>
            </button>
          ))}
        </div>

        <p className="text-center mt-6 text-muted text-sm">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-primary-soft font-semibold">Sign Up</button>
        </p>
      </div>
    </motion.div>
  );
}
