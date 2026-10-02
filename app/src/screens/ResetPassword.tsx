import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Lock, Mail, Key } from 'lucide-react';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { auth } from '@/api/endpoints';
import { useUIStore } from '@/store/ui';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToast = useUIStore((s) => s.addToast);

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email || !/\S+@\S+\.\S+/.test(email)) errs.email = 'Valid email is required';
    if (!code) errs.code = 'Reset code is required';
    if (!newPassword || newPassword.length < 8) errs.newPassword = 'Must be at least 8 characters';
    if (confirmPassword !== newPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await auth.resetPassword({ email, token: code, newPassword });
      addToast('Password updated', 'success');
      navigate('/login', { replace: true });
    } catch (err: any) {
      setErrors({ code: err?.message || 'Invalid or expired code' });
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
          <h1 className="t-h1 text-[28px] font-bold text-text">Set a new password</h1>
        </div>
      </div>

      {/* Sheet */}
      <div className="w-full min-h-[calc(100%-220px)] bg-surface surface-glass rounded-t-[32px] border-t border-line p-6 flex flex-col justify-between">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <Input
            label="Reset code"
            icon={Key}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
          />

          <Input
            label="New password"
            icon={Lock}
            isPassword
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={errors.newPassword}
          />

          <Input
            label="Confirm password"
            icon={Lock}
            isPassword
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />

          <Button size="lg" type="submit" loading={loading} className="w-full mt-4">
            Reset password
          </Button>
        </form>
      </div>
    </div>
  );
}
