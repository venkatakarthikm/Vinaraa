import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { users } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { pageTransitionVariants } from '@/motion';
import { ChevronLeft, ChevronRight, Lock, LogOut, Download, Trash2, Music2, Edit3 } from 'lucide-react';

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    users.me().then((d) => { setProfile(d); }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async () => {
    await users.deleteAccount();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <motion.div className="flex flex-col h-full bg-bg"
      initial="initial" animate="animate" exit="exit" variants={pageTransitionVariants}>
      <div className="flex items-center px-4 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-surface-2" aria-label="Back">
          <ChevronLeft size={24} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text ml-3">Profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y px-5 pb-10">
        <div className="flex flex-col items-center py-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 shadow-colored">
            <span className="text-white text-3xl font-bold">{(profile?.user?.name || 'U')[0].toUpperCase()}</span>
          </div>
          <h2 className="text-text text-xl font-bold">{profile?.user?.name || '—'}</h2>
          <p className="text-muted text-sm">{profile?.user?.email || '—'}</p>
          {profile?.historyDepth > 0 && (
            <span className="mt-2 text-xs bg-mint/20 text-mint px-3 py-1 rounded-pill font-semibold">
              {profile.historyDepth} sessions tracked
            </span>
          )}
        </div>

        {profile?.taste && (
          <div className="bg-surface-2 border border-border rounded-2xl p-4 mb-6">
            <p className="text-muted text-xs mb-2">Your Taste</p>
            <div className="flex flex-wrap gap-2">
              {profile.taste.topEntities?.slice(0, 6).map((e: any) => (
                <span key={e.id || e.name} className="bg-primary/20 text-primary-soft text-xs px-3 py-1 rounded-pill">{e.name}</span>
              ))}
              {(!profile.taste.topEntities || profile.taste.topEntities.length === 0) && (
                <p className="text-muted text-sm">Listen to songs to build your taste profile.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {[
            { icon: <Edit3 size={20} />, label: 'Edit Taste', onClick: () => navigate('/onboarding') },
            { icon: <Lock size={20} />, label: 'Change Password', onClick: () => navigate('/settings') },
            { icon: <Download size={20} />, label: 'Export My Data', onClick: () => users.exportData().then(() => {}) },
            { icon: <Music2 size={20} />, label: 'Settings', onClick: () => navigate('/settings') },
          ].map(({ icon, label, onClick }) => (
            <button key={label} onClick={onClick}
              className="flex items-center gap-4 px-4 py-4 bg-surface-2 border border-border rounded-2xl">
              <span className="text-muted">{icon}</span>
              <span className="text-text font-medium flex-1 text-left">{label}</span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          ))}

          <button onClick={handleLogout}
            className="flex items-center gap-4 px-4 py-4 bg-surface-2 border border-danger/40 rounded-2xl">
            <LogOut size={20} className="text-danger" />
            <span className="text-danger font-medium flex-1 text-left">Sign Out</span>
          </button>
          <button onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-4 px-4 py-4 bg-danger/10 border border-danger/40 rounded-2xl">
            <Trash2 size={20} className="text-danger" />
            <span className="text-danger font-medium flex-1 text-left">Delete Account</span>
          </button>
        </div>

        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
            <div className="bg-surface border-t border-border rounded-t-3xl w-full p-6">
              <h3 className="text-text font-bold text-lg mb-2">Delete Account?</h3>
              <p className="text-muted text-sm mb-6">This will permanently delete your account and all data.</p>
              <button onClick={handleDeleteAccount} className="w-full py-4 bg-danger text-white font-bold rounded-pill mb-3">
                Yes, Delete My Account
              </button>
              <button onClick={() => setConfirmDelete(false)} className="w-full py-4 text-muted font-semibold">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
