import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { users } from '@/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { pageTransitionVariants, listStaggerVariants } from '@/motion';
import { ChevronLeft, ChevronRight, Lock, LogOut, Download, Music2, Edit3, Trash2, AlertTriangle } from 'lucide-react';

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    users.me().then((d) => setProfile(d)).catch(() => {});
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

  const menuItems = [
    { icon: Edit3, label: 'Edit Taste',       sub: 'Refine your recommendations',  onClick: () => navigate('/onboarding'), color: 'var(--color-primary-soft)' },
    { icon: Lock,  label: 'Change Password',  sub: 'Update your security',         onClick: () => navigate('/settings'), color: 'var(--color-mint)' },
    { icon: Download, label: 'Export My Data', sub: 'Download your history',        onClick: () => users.exportData?.().then(() => {}), color: 'var(--color-amber)' },
    { icon: Music2, label: 'Settings',         sub: 'Audio, notifications, more',   onClick: () => navigate('/settings'), color: 'var(--color-primary-soft)' },
  ];

  return (
    <motion.div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg)' }}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
    >
      {/* Header */}
      <div className="flex items-center px-4" style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)`, paddingBottom: 12 }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center mr-3"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          aria-label="Back"
        >
          <ChevronLeft size={20} style={{ color: 'var(--color-text)' }} />
        </motion.button>
        <h1 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>Profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y px-5 pb-10">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center py-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.1 }}
            className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              boxShadow: '0 12px 40px rgba(139,61,255,0.4)',
            }}
          >
            <span className="text-white text-3xl font-black">{(profile?.user?.name || 'U')[0].toUpperCase()}</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-xl font-black mb-1"
            style={{ color: 'var(--color-text)' }}
          >
            {profile?.user?.name || '—'}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm"
            style={{ color: 'var(--color-muted)' }}
          >
            {profile?.user?.email || '—'}
          </motion.p>
          {profile?.historyDepth > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-3 text-xs px-3 py-1 rounded-pill font-bold"
              style={{ background: 'rgba(45,225,181,0.15)', color: 'var(--color-mint)' }}
            >
              {profile.historyDepth} sessions tracked
            </motion.span>
          )}
        </div>

        {/* Taste Tags */}
        {profile?.taste?.topEntities?.length > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(40,36,77,0.5)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted)' }}>Your Taste</p>
            <div className="flex flex-wrap gap-2">
              {profile.taste.topEntities.slice(0, 8).map((e: any) => (
                <span
                  key={e.id || e.name}
                  className="text-xs px-3 py-1.5 rounded-pill font-semibold"
                  style={{ background: 'rgba(139,61,255,0.15)', color: 'var(--color-primary-soft)' }}
                >
                  {e.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Menu items */}
        <div className="flex flex-col gap-2 mb-4">
          {menuItems.map(({ icon: Icon, label, sub, onClick, color }, i) => (
            <motion.button
              key={label}
              custom={i}
              variants={listStaggerVariants}
              initial="initial"
              animate="animate"
              whileTap={{ scale: 0.98 }}
              onClick={onClick}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl w-full text-left"
              style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(40,36,77,0.5)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--color-muted)' }} />
            </motion.button>
          ))}
        </div>

        {/* Danger zone */}
        <div className="flex flex-col gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="flex items-center gap-4 px-4 py-4 rounded-2xl w-full"
            style={{ background: 'rgba(255,84,112,0.08)', border: '1px solid rgba(255,84,112,0.3)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,84,112,0.15)' }}>
              <LogOut size={18} style={{ color: 'var(--color-danger)' }} />
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--color-danger)' }}>Sign Out</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-4 px-4 py-4 rounded-2xl w-full"
            style={{ background: 'rgba(255,84,112,0.05)', border: '1px solid rgba(255,84,112,0.2)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,84,112,0.1)' }}>
              <Trash2 size={18} style={{ color: 'var(--color-danger)' }} />
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--color-danger)' }}>Delete Account</span>
          </motion.button>
        </div>
      </div>

      {/* Delete Confirmation Sheet */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(false)}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.7)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 34 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-6 pb-10 pt-6"
              style={{ background: 'var(--color-surface)', borderTop: '1px solid rgba(40,36,77,0.6)' }}
            >
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle size={22} style={{ color: 'var(--color-danger)' }} />
                <h3 className="font-black text-lg" style={{ color: 'var(--color-text)' }}>Delete Account?</h3>
              </div>
              <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
                This will permanently delete your account, playlists, and listening history. This action cannot be undone.
              </p>
              <button
                onClick={handleDeleteAccount}
                className="w-full py-4 rounded-2xl text-white font-bold mb-3 text-sm"
                style={{ background: 'var(--color-danger)' }}
              >
                Yes, Delete My Account
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-full py-3 font-semibold text-sm"
                style={{ color: 'var(--color-muted)' }}
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
