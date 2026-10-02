import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail } from 'lucide-react';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { auth } from '@/api/endpoints';
import { useUIStore } from '@/store/ui';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (sent && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [sent, countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await auth.forgotPassword(email);
      setSent(true);
      setCountdown(30);
    } catch (err: any) {
      addToast(err?.message || 'Failed to send reset link', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-bg overflow-y-auto">
      {/* Hero */}
      <div className="relative h-[220px] px-5 pt-[calc(var(--sat)+8px)] flex flex-col justify-between">
        <button
          onClick={() => navigate('/login')}
          className="w-10 h-10 rounded-full bg-surface-2/80 flex items-center justify-center text-text"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="mb-4">
          <h1 className="t-h1 text-[28px] font-bold text-text">Forgot password?</h1>
          <p className="t-cap text-[13px] text-muted mt-1">
            Enter your email and we'll send a reset link.
          </p>
        </div>
      </div>

      {/* Sheet */}
      <div className="w-full min-h-[calc(100%-220px)] bg-surface surface-glass rounded-t-[32px] border-t border-line p-6 flex flex-col justify-between">
        {!sent ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
              placeholder="you@example.com"
            />

            <Button size="lg" type="submit" loading={loading} className="w-full mt-4">
              Send reset link
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-primary mb-2">
              <Mail size={32} />
            </div>

            <h2 className="t-h2 text-[20px] font-bold text-text">Check your mail</h2>
            <p className="t-body text-[15px] text-muted max-w-[280px]">
              If an account exists for <span className="text-text font-semibold">{email}</span>, we've sent instructions.
            </p>

            <div className="w-full flex flex-col items-center gap-3 mt-4">
              <Button
                size="lg"
                onClick={() => (window.location.href = 'mailto:')}
                className="w-full"
              >
                Open mail app
              </Button>

              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Back to login
              </Button>

              {countdown > 0 ? (
                <span className="t-cap text-[12px] text-muted">
                  Resend in 0:{countdown < 10 ? `0${countdown}` : countdown}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="t-cap text-[13px] text-primary font-semibold hover:underline"
                >
                  Resend email
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
