import { useState } from 'react';
import { motion } from 'framer-motion';
import { pageTransitionVariants } from '@/motion';
import { auth } from '@/api/endpoints';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Hash, ChevronLeft, Mail } from 'lucide-react';

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
      navigate('/login', { replace: true, state: { message: 'Password reset successfully! Sign in.' } });
    } catch (err: any) {
      setError(err.message || 'Reset failed. Token may have expired.');
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
      <div className="flex-1 px-6 pt-4">
        <h1 className="text-3xl font-bold text-text mb-2">Reset Password</h1>
        <p className="text-muted mb-8">Enter the reset token from your email.</p>
        {error && (
          <div className="bg-danger/20 border border-danger/40 text-danger rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>
        )}
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input type="email" required
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-4 outline-none border border-border focus:border-primary-soft"
              placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input type="text" required
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-4 outline-none border border-border focus:border-primary-soft"
              placeholder="Reset Token" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
            <input type={showPass ? 'text' : 'password'} required minLength={8}
              className="w-full bg-surface-2 text-text rounded-2xl py-4 pl-12 pr-12 outline-none border border-border focus:border-primary-soft"
              placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-4 mt-2 shadow-colored disabled:opacity-70">
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
