import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Mail, Lock, User as UserIcon } from 'lucide-react';
import { auth } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { getDeviceInfo } from '@/utils/device';

export default function AuthScreen({ initialTab = 'login' }: { initialTab?: 'login' | 'register' }) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const navigate = useNavigate();
  const location = useLocation();
  const loginStore = useAuthStore((s) => s.login);
  const addToast = useUIStore((s) => s.addToast);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Loading & Errors
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password Strength Calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 1: weak, 2: fair, 3: good, 4: strong
  };

  const passStrength = getPasswordStrength(password);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', 'bg-danger', 'bg-[#F5A524]', 'bg-accent', 'bg-success'];

  const handleTabChange = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setErrors({});
    if (tab === 'login' && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    } else if (tab === 'register' && location.pathname !== '/register') {
      navigate('/register', { replace: true });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Enter a valid email address';
    }
    if (!password || password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (activeTab === 'register') {
      if (!name || name.trim().length < 2) {
        errs.name = 'Name must be at least 2 characters';
      }
      if (confirmPassword !== password) {
        errs.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const device = await getDeviceInfo();
      const devicePayload = {
        deviceId: device.deviceId,
        platform: 'android',
        model: (device as any).model || 'Android Phone',
        appVersion: '1.0.0',
      };

      if (activeTab === 'login') {
        const res = await auth.login({
          email,
          password,
          device: devicePayload,
        });

        if (res.user && res.tokens?.accessToken) {
          await loginStore(res.user, { accessToken: res.tokens.accessToken });
          addToast(`Welcome back, ${res.user.name.split(' ')[0]}!`, 'success');
          if (res.user.onboarding?.completed) {
            navigate('/home', { replace: true });
          } else {
            navigate('/onboarding', { replace: true });
          }
        }
      } else {
        const res = await auth.register({
          email,
          password,
          name,
          device: devicePayload,
        });

        if (res.user && res.tokens?.accessToken) {
          await loginStore(res.user, { accessToken: res.tokens.accessToken });
          addToast('Account created!', 'success');
          navigate('/onboarding', { replace: true });
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const code = err?.code || err?.error?.code;
      const msg = err?.message || 'Authentication failed';

      if (code === 'INVALID_CREDENTIALS') {
        setErrors({ password: 'Email or password is incorrect' });
      } else if (msg.toLowerCase().includes('already registered')) {
        setErrors({ email: 'This email is already registered. Log in instead.' });
      } else {
        addToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-bg overflow-y-auto">
      {/* Hero Block (y 0 - 264) */}
      <div className="relative h-[264px] px-5 pt-[calc(var(--sat)+8px)] flex flex-col justify-between">
        <button
          onClick={() => navigate('/welcome')}
          className="w-10 h-10 rounded-full bg-surface-2/80 flex items-center justify-center text-text"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="mb-6">
          <div className="w-12 h-12 rounded-[16px] bg-primary flex items-center justify-center mb-3">
            <UserIcon size={24} className="text-on-primary" />
          </div>
          <h1 className="t-h1 text-[28px] font-bold text-text">
            {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="t-cap text-[13px] text-muted mt-1">
            {activeTab === 'login' ? 'Pick up where you left off.' : 'It takes a minute.'}
          </p>
        </div>
      </div>

      {/* Sheet Block */}
      <div className="w-full min-h-[calc(100%-264px)] bg-surface surface-glass rounded-t-[32px] border-t border-line p-6 flex flex-col justify-between gap-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Segmented Control */}
          <div className="h-[52px] bg-surface-2 p-1 rounded-[26px] flex items-center mb-2">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 h-full rounded-[22px] t-cap text-[14px] font-semibold transition-colors ${
                activeTab === 'login' ? 'bg-primary text-on-primary shadow-sm' : 'text-muted'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`flex-1 h-full rounded-[22px] t-cap text-[14px] font-semibold transition-colors ${
                activeTab === 'register' ? 'bg-primary text-on-primary shadow-sm' : 'text-muted'
              }`}
            >
              Register
            </button>
          </div>

          {/* Form Fields */}
          {activeTab === 'register' && (
            <Input
              label="Full name"
              icon={UserIcon}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="Your name"
            />
          )}

          <Input
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="you@example.com"
          />

          <div>
            <Input
              label="Password"
              icon={Lock}
              isPassword
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />

            {/* Password Strength Meter (Register only) */}
            {activeTab === 'register' && password.length > 0 && (
              <div className="mt-2 px-1 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="t-micro text-[11px] text-muted">Password strength</span>
                  <span className="t-micro text-[11px] font-semibold text-text">
                    {strengthLabels[passStrength]}
                  </span>
                </div>
                <div className="flex items-center gap-1 h-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`flex-1 h-full rounded-full transition-colors ${
                        step <= passStrength ? strengthColors[passStrength] : 'bg-surface-2'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {activeTab === 'register' && (
            <Input
              label="Confirm password"
              icon={Lock}
              isPassword
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
            />
          )}

          {/* Row (Login only) */}
          {activeTab === 'login' && (
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-[22px] h-[22px] rounded-[6px] accent-primary"
                />
                <span className="t-cap text-[13px] text-text font-medium">Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="t-cap text-[13px] text-primary font-semibold hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <Button
            size="lg"
            type="submit"
            loading={loading}
            loadingText={activeTab === 'login' ? 'Signing in…' : 'Creating account…'}
            className="w-full mt-2 sticky bottom-2"
          >
            {activeTab === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </form>

        {/* Bottom Social & Legal */}
        <div className="flex flex-col gap-4 pt-2">
          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-[1px] bg-line" />
            <span className="t-cap text-[12px] text-muted">or continue with</span>
            <div className="flex-1 h-[1px] bg-line" />
          </div>

          {/* Social Buttons (Disabled D11) */}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => addToast('Coming soon', 'info')}
              className="flex-1 h-[52px] opacity-50 cursor-not-allowed"
            >
              Google
            </Button>
            <Button
              variant="secondary"
              onClick={() => addToast('Coming soon', 'info')}
              className="flex-1 h-[52px] opacity-50 cursor-not-allowed"
            >
              Facebook
            </Button>
          </div>

          {/* Legal line */}
          <p className="t-cap text-[12px] text-muted text-center leading-relaxed">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
