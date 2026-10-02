import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '@/components/Page';
import { usePrefsStore } from '@/store/prefs';
import type { ThemeMode } from '@/store/prefs';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { users, auth as authApi } from '@/api/endpoints';
import ThemeSheet from '@/components/ThemeSheet';
import { Sheet } from '@/components/SheetHost';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { ChevronRight, SunMoon, Palette, Check } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const logout = useAuthStore((s) => s.logout);

  const {
    theme,
    mode, setMode,
    playerStyle,
    ambientGlow,
    reduceEffects, setReduceEffects,
  } = usePrefsStore();

  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [preferences, setPreferences] = useState<any>({});

  // Sheets
  const [qualitySheetOpen, setQualitySheetOpen] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [devModeClicks, setDevModeClicks] = useState(0);

  // Password fields
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  useEffect(() => {
    users.me()
      .then((res) => {
        if (res?.data?.user?.preferences) {
          setPreferences(res.data.user.preferences);
        }
      })
      .catch(() => {});
  }, []);

  const updatePref = async (key: string, value: any) => {
    const prev = { ...preferences };
    const next = { ...preferences, [key]: value };
    setPreferences(next);

    try {
      await users.updatePreferences({ [key]: value });
    } catch (_e) {
      setPreferences(prev);
      addToast('Failed to update settings', 'error');
    }
  };

  const handleChangePassword = async () => {
    if (newPass.length < 8) {
      addToast('Password must be at least 8 characters', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      addToast('Passwords do not match', 'error');
      return;
    }

    try {
      await authApi.changePassword({ currentPassword: currentPass, newPassword: newPass });
      addToast('Password updated', 'success');
      setChangePassOpen(false);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (_e) {
      addToast('Failed to change password', 'error');
    }
  };

  const handleVersionClick = () => {
    const next = devModeClicks + 1;
    setDevModeClicks(next);
    if (next === 7) {
      addToast('Developer mode enabled', 'info');
    }
  };

  return (
    <Page title="Settings">
      <div className="flex flex-col gap-6 px-5 pt-4 pb-[120px]">
        {/* GROUP 1: APPEARANCE */}
        <section className="flex flex-col gap-2">
          <span className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider px-1">
            Appearance
          </span>
          <div className="bg-surface rounded-[24px] border border-line flex flex-col divide-y divide-line/20 overflow-hidden">
            <button
              onClick={() => setThemeSheetOpen(true)}
              className="h-[56px] px-4 flex items-center justify-between hover:bg-surface-2 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Palette size={20} className="text-text" />
                <span className="t-h3 text-[15px] font-semibold text-text">Theme</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="t-cap text-[13px] text-muted capitalize">{theme}</span>
                <ChevronRight size={18} className="text-muted" />
              </div>
            </button>

            <div className="h-[56px] px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SunMoon size={20} className="text-text" />
                <span className="t-h3 text-[15px] font-semibold text-text">Mode</span>
              </div>
              <div className="h-[36px] bg-surface-2 p-1 rounded-full flex items-center">
                {['system', 'light', 'dark'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m as ThemeMode)}
                    className={`px-3 h-full rounded-full t-micro text-[11px] font-bold capitalize transition-all ${
                      mode === m ? 'bg-primary text-on-primary' : 'text-muted'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[56px] px-4 flex items-center justify-between">
              <span className="t-h3 text-[15px] font-semibold text-text">Player style</span>
              <span className="t-cap text-[13px] text-muted capitalize">{playerStyle}</span>
            </div>

            <div className="h-[56px] px-4 flex items-center justify-between">
              <span className="t-h3 text-[15px] font-semibold text-text">Ambient glow</span>
              <span className="t-cap text-[13px] text-muted capitalize">{ambientGlow}</span>
            </div>

            <div className="h-[56px] px-4 flex items-center justify-between">
              <span className="t-h3 text-[15px] font-semibold text-text">Reduce effects</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={reduceEffects}
                  onChange={(e) => setReduceEffects(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-[52px] h-[32px] bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-primary" />
              </label>
            </div>
          </div>
        </section>

        {/* GROUP 2: PLAYBACK */}
        <section className="flex flex-col gap-2">
          <span className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider px-1">
            Playback
          </span>
          <div className="bg-surface rounded-[24px] border border-line flex flex-col divide-y divide-line/20 overflow-hidden">
            <button
              onClick={() => setQualitySheetOpen(true)}
              className="h-[56px] px-4 flex items-center justify-between hover:bg-surface-2 transition-colors text-left"
            >
              <span className="t-h3 text-[15px] font-semibold text-text">Audio quality</span>
              <div className="flex items-center gap-2">
                <span className="t-cap text-[13px] text-muted capitalize">
                  {preferences?.audioQuality || 'High (160 kbps)'}
                </span>
                <ChevronRight size={18} className="text-muted" />
              </div>
            </button>

            <div className="h-[56px] px-4 flex items-center justify-between">
              <span className="t-h3 text-[15px] font-semibold text-text">Data saver</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(preferences?.dataSaver)}
                  onChange={(e) => updatePref('dataSaver', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-[52px] h-[32px] bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-primary" />
              </label>
            </div>

            <div className="h-[56px] px-4 flex items-center justify-between">
              <span className="t-h3 text-[15px] font-semibold text-text">
                Autoplay similar songs
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.autoplay !== false}
                  onChange={(e) => updatePref('autoplay', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-[52px] h-[32px] bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-primary" />
              </label>
            </div>

            <div className="h-[56px] px-4 flex items-center justify-between">
              <span className="t-h3 text-[15px] font-semibold text-text">Explicit songs</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.explicitContent !== false}
                  onChange={(e) => updatePref('explicitContent', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-[52px] h-[32px] bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-primary" />
              </label>
            </div>
          </div>
        </section>

        {/* GROUP 3: ACCOUNT & SECURITY */}
        <section className="flex flex-col gap-2">
          <span className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider px-1">
            Account & Security
          </span>
          <div className="bg-surface rounded-[24px] border border-line flex flex-col divide-y divide-line/20 overflow-hidden">
            <button
              onClick={() => setChangePassOpen(true)}
              className="h-[56px] px-4 flex items-center justify-between hover:bg-surface-2 transition-colors text-left"
            >
              <span className="t-h3 text-[15px] font-semibold text-text">Change password</span>
              <ChevronRight size={18} className="text-muted" />
            </button>

            <button
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
              className="h-[56px] px-4 flex items-center justify-between hover:bg-surface-2 transition-colors text-left text-text"
            >
              <span className="t-h3 text-[15px] font-semibold">Log out</span>
            </button>
          </div>
        </section>

        {/* GROUP 4: ABOUT */}
        <section className="flex flex-col gap-2">
          <span className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider px-1">
            About
          </span>
          <div className="bg-surface rounded-[24px] border border-line flex flex-col divide-y divide-line/20 overflow-hidden">
            <div
              onClick={handleVersionClick}
              className="h-[56px] px-4 flex items-center justify-between cursor-pointer"
            >
              <span className="t-h3 text-[15px] font-semibold text-text">Version</span>
              <span className="t-cap text-[13px] text-muted">1.0.0</span>
            </div>

            {devModeClicks >= 7 && (
              <div className="h-[56px] px-4 flex items-center justify-between bg-primary/10">
                <span className="t-h3 text-[15px] font-semibold text-primary">API Endpoint</span>
                <span className="t-cap text-[12px] text-primary truncate max-w-[200px]">
                  {import.meta.env.VITE_API_BASE_URL || 'https://vinaraa.onrender.com/api/v1'}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Theme Sheet */}
      <ThemeSheet isOpen={themeSheetOpen} onClose={() => setThemeSheetOpen(false)} />

      {/* Audio Quality Sheet */}
      <Sheet
        id="audio-quality-sheet"
        isOpen={qualitySheetOpen}
        onClose={() => setQualitySheetOpen(false)}
        title="Audio quality"
      >
        <div className="flex flex-col divide-y divide-line/20 py-2">
          {[
            { id: 'low', label: 'Low (48 kbps · Data saver)' },
            { id: 'medium', label: 'Medium (96 kbps)' },
            { id: 'high', label: 'High (160 kbps)' },
            { id: 'veryhigh', label: 'Very High (320 kbps · Best)' },
          ].map((q) => (
            <button
              key={q.id}
              onClick={() => {
                updatePref('audioQuality', q.id);
                setQualitySheetOpen(false);
              }}
              className="h-[56px] px-3 flex items-center justify-between hover:bg-surface-2 rounded-[16px] text-left"
            >
              <span className="t-h3 text-[15px] font-semibold text-text">{q.label}</span>
              {preferences?.audioQuality === q.id && <Check size={18} className="text-primary" />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Change Password Sheet */}
      <Sheet
        id="change-password-sheet"
        isOpen={changePassOpen}
        onClose={() => setChangePassOpen(false)}
        title="Change password"
      >
        <div className="flex flex-col gap-4 py-2">
          <Input
            label="Current password"
            isPassword
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
          />
          <Input
            label="New password"
            isPassword
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
          <Input
            label="Confirm new password"
            isPassword
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
          />
          <Button size="lg" onClick={handleChangePassword} className="w-full mt-2">
            Change password
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
