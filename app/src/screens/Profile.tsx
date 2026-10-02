import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Palette, Download, Languages, LogOut, Trash2 } from 'lucide-react';
import Page from '@/components/Page';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Chip from '@/components/Chip';
import { Sheet } from '@/components/SheetHost';
import { users } from '@/api/endpoints';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useUIStore((s) => s.addToast);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [newName, setNewPlaylistName] = useState(user?.name || '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleUpdateName = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      addToast('Name must be at least 2 characters', 'error');
      return;
    }
    try {
      const updated = await users.updateMe({ name: newName.trim() });
      updateUser(updated?.user || { ...user, name: newName.trim() });
      addToast('Profile updated', 'success');
      setEditProfileOpen(false);
    } catch (_e) {
      addToast('Failed to update name', 'error');
    }
  };

  const handleExportData = async () => {
    try {
      const data = await users.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vinaraa-export.json';
      a.click();
      addToast('Exported your data', 'success');
    } catch (_e) {
      addToast('Failed to export data', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      addToast('Type DELETE to confirm', 'error');
      return;
    }
    try {
      await users.deleteAccount();
      await logout();
      navigate('/welcome', { replace: true });
    } catch (_e) {
      addToast('Failed to delete account', 'error');
    }
  };

  return (
    <Page
      title="Profile"
      headerActions={
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      }
    >
      <div className="flex flex-col gap-6 px-5 pt-4 pb-[120px]">
        {/* Top Profile Block */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-on-primary font-bold t-h1 shadow-md">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (user?.name || 'U')[0].toUpperCase()
            )}
          </div>

          <div className="flex flex-col items-center">
            <h1 className="t-h1 text-[24px] font-bold text-text">{user?.name || 'User'}</h1>
            <p className="t-cap text-[13px] text-muted">{user?.email}</p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNewPlaylistName(user?.name || '');
              setEditProfileOpen(true);
            }}
          >
            Edit profile
          </Button>
        </div>

        {/* Stat Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface p-4 rounded-[20px] border border-line text-center flex flex-col items-center">
            <span className="t-h2 text-[20px] font-bold text-text">0</span>
            <span className="t-cap text-[12px] text-muted">Playlists</span>
          </div>
          <div className="bg-surface p-4 rounded-[20px] border border-line text-center flex flex-col items-center">
            <span className="t-h2 text-[20px] font-bold text-text">0</span>
            <span className="t-cap text-[12px] text-muted font-normal">Plays tracked</span>
          </div>
          <div className="bg-surface p-4 rounded-[20px] border border-line text-center flex flex-col items-center">
            <span className="t-h2 text-[20px] font-bold text-text">
              {user?.preferences?.languages?.length || 1}
            </span>
            <span className="t-cap text-[12px] text-muted">Languages</span>
          </div>
        </div>

        {/* Your Taste Card */}
        <div className="bg-surface p-5 rounded-[24px] border border-line flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="t-h3 text-[16px] font-bold text-text">Your taste</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/onboarding')}>
              Edit taste
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(user?.preferences?.languages || ['Hindi', 'Telugu']).map((lang: string) => (
              <Chip key={lang} label={lang} selected />
            ))}
          </div>
        </div>

        {/* Profile Options Rows */}
        <div className="bg-surface rounded-[24px] border border-line flex flex-col divide-y divide-line/20 overflow-hidden">
          <button
            onClick={() => navigate('/settings')}
            className="h-[56px] px-4 flex items-center gap-4 hover:bg-surface-2 text-left transition-colors"
          >
            <Palette size={20} className="text-text" />
            <span className="t-h3 text-[15px] font-semibold text-text">Appearance</span>
          </button>

          <button
            onClick={() => navigate('/downloads')}
            className="h-[56px] px-4 flex items-center gap-4 hover:bg-surface-2 text-left transition-colors"
          >
            <Download size={20} className="text-text" />
            <span className="t-h3 text-[15px] font-semibold text-text">Downloads</span>
          </button>

          <button
            onClick={() => navigate('/onboarding')}
            className="h-[56px] px-4 flex items-center gap-4 hover:bg-surface-2 text-left transition-colors"
          >
            <Languages size={20} className="text-text" />
            <span className="t-h3 text-[15px] font-semibold text-text">Language & taste</span>
          </button>

          <button
            onClick={handleExportData}
            className="h-[56px] px-4 flex items-center gap-4 hover:bg-surface-2 text-left transition-colors"
          >
            <Download size={20} className="text-text" />
            <span className="t-h3 text-[15px] font-semibold text-text">Export my data</span>
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="h-[56px] px-4 flex items-center gap-4 hover:bg-surface-2 text-left transition-colors text-text"
          >
            <LogOut size={20} />
            <span className="t-h3 text-[15px] font-semibold">Log out</span>
          </button>

          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="h-[56px] px-4 flex items-center gap-4 hover:bg-surface-2 text-left transition-colors text-danger"
          >
            <Trash2 size={20} />
            <span className="t-h3 text-[15px] font-semibold">Delete account</span>
          </button>
        </div>

        {/* Footer */}
        <p className="t-cap text-[12px] text-muted text-center pt-2">
          Vinaraa v1.0.0
        </p>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet
        id="edit-profile-sheet"
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        title="Edit profile"
      >
        <div className="flex flex-col gap-4 py-2">
          <Input
            label="Full name"
            value={newName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
          />
          <Button size="lg" onClick={handleUpdateName} className="w-full mt-2">
            Save
          </Button>
        </div>
      </Sheet>

      {/* Delete Account Dialog Sheet */}
      <Sheet
        id="delete-account-sheet"
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete account"
      >
        <div className="flex flex-col gap-4 py-2">
          <p className="t-body text-[15px] text-muted">
            This action is permanent and cannot be undone. Type <span className="text-danger font-bold">DELETE</span> below to confirm.
          </p>
          <Input
            label="Type DELETE"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <Button variant="danger" size="lg" onClick={handleDeleteAccount} className="w-full mt-2">
            Delete account permanently
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
