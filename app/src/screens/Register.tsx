import { useState } from 'react';
import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { auth } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import { getDeviceInfo } from '@/utils/device';
import { Mail, Lock, Eye, EyeOff, User, ChevronLeft } from 'lucide-react';

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColors = ['', 'bg-danger', 'bg-amber', 'bg-mint', 'bg-mint'];

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const strength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      const deviceInfo = await getDeviceInfo();
      const res = await auth.register({
        name,
        email,
        password,
        device: deviceInfo,
      });
      await login(res.user, { accessToken: res.tokens.accessToken, refreshToken: res.tokens.refreshToken });
      // Check onboarding
      if (!res.user?.onboarding?.completed) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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

      <div className="flex-1 px-6 pt-2 pb-8 scroll-y overflow-y-auto">
        <h1 className="text-3xl font-bold text-text mb-2">Create Account</h1>
        <p className="text-muted mb-8">Join Vinaraa and discover your music.</p>

        {error && (
          <div className="bg-danger/20 border border-danger/40 text-danger rounded-xl px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input
              type="text" required
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-4 outline-none border border-border focus:border-primary-soft transition-colors"
              placeholder="Full Name"
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input
              type="email" required
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-4 outline-none border border-border focus:border-primary-soft transition-colors"
              placeholder="Email Address"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
              <input
                type={showPass ? 'text' : 'password'} required
                className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-12 outline-none border border-border focus:border-primary-soft transition-colors"
                placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
                onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {password && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`flex-1 h-1 rounded-pill ${i <= strength ? strengthColors[strength] : 'bg-surface-2'}`} />
                ))}
                <span className="text-xs ml-2 text-muted">{strengthLabels[strength]}</span>
              </div>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input
              type={showPass ? 'text' : 'password'} required
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-4 outline-none border border-border focus:border-primary-soft transition-colors"
              placeholder="Confirm Password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-4 mt-2 shadow-colored disabled:opacity-70"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="mx-4 text-muted text-sm">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-3">
          {['G', 'A'].map((s) => (
            <button key={s} disabled className="flex-1 py-4 bg-surface-2 border border-border rounded-2xl text-muted opacity-50 relative text-sm font-semibold">
              {s === 'G' ? 'Google' : 'Apple'}
              <span className="absolute -top-2 right-2 text-[9px] bg-surface text-muted px-1.5 py-0.5 rounded-pill border border-border">Soon</span>
            </button>
          ))}
        </div>

        <p className="text-center mt-6 text-muted text-sm">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-primary-soft font-semibold">Sign In</button>
        </p>
      </div>
    </motion.div>
  );
}
