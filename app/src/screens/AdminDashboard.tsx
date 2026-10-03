import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/api/client';
import Page from '@/components/Page';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useUIStore } from '@/store/ui';
import {
  Users, Layers, Megaphone, Send, Trash2, Edit3, Search,
  Activity, ShieldAlert, Database
} from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'popups' | 'notifications';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);

  const [tab, setTab] = useState<AdminTab>('overview');

  // Overview Stats
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Users Management
  const [userList, setUserList] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Popups Management
  const [popups, setPopups] = useState<any[]>([]);
  const [editingPopup, setEditingPopup] = useState<any>(null);
  const [popupName, setPopupName] = useState('');
  const [popupHtml, setPopupHtml] = useState('');
  const [popupEnabled, setPopupEnabled] = useState(false);

  // Notifications Management
  const [templates, setTemplates] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);

  // Check admin role
  useEffect(() => {
    if (user && user.role !== 'admin') {
      addToast('Admin access required', 'error');
      navigate('/home', { replace: true });
    }
  }, [user, navigate, addToast]);

  // Load Overview Data
  useEffect(() => {
    if (tab === 'overview') {
      setLoadingStats(true);
      apiClient<any>('/admin/stats')
        .then((res) => setStats(res))
        .catch(() => addToast('Failed to load admin stats', 'error'))
        .finally(() => setLoadingStats(false));
    } else if (tab === 'users') {
      setLoadingUsers(true);
      apiClient<any>(`/admin/users?q=${encodeURIComponent(userQuery)}`)
        .then((res: any) => setUserList(res?.data || res || []))
        .catch(() => addToast('Failed to load users', 'error'))
        .finally(() => setLoadingUsers(false));
    } else if (tab === 'popups') {
      apiClient<any>('/admin/popups')
        .then((res: any) => setPopups(res?.data || res || []))
        .catch(() => {});
    } else if (tab === 'notifications') {
      apiClient<any>('/admin/notification-templates')
        .then((res: any) => setTemplates(res?.data || res || []))
        .catch(() => {});
      apiClient<any>('/admin/notifications/campaigns')
        .then((res: any) => setCampaigns(res?.data || res || []))
        .catch(() => {});
    }
  }, [tab, userQuery, addToast]);

  const handleSavePopup = async () => {
    if (!popupName.trim() || !popupHtml.trim()) {
      addToast('Popup name and HTML are required', 'error');
      return;
    }
    try {
      if (editingPopup?._id || editingPopup?.id) {
        const id = editingPopup._id || editingPopup.id;
        await apiClient(`/admin/popups/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: popupName, html: popupHtml, enabled: popupEnabled }),
        });
        addToast('Popup updated', 'success');
      } else {
        await apiClient('/admin/popups', {
          method: 'POST',
          body: JSON.stringify({ name: popupName, html: popupHtml, enabled: popupEnabled, audience: { mode: 'all' } }),
        });
        addToast('Popup created', 'success');
      }
      setEditingPopup(null);
      setPopupName('');
      setPopupHtml('');
      setPopupEnabled(false);
      apiClient<any>('/admin/popups').then((res: any) => setPopups(res?.data || res || []));
    } catch (_e) {
      addToast('Failed to save popup', 'error');
    }
  };

  const handleDeletePopup = async (id: string) => {
    if (!window.confirm('Delete this popup?')) return;
    try {
      await apiClient(`/admin/popups/${id}`, { method: 'DELETE' });
      setPopups((prev) => prev.filter((p) => (p._id || p.id) !== id));
      addToast('Popup deleted', 'info');
    } catch (_e) {
      addToast('Failed to delete popup', 'error');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !titleTemplate.trim() || !bodyTemplate.trim()) {
      addToast('Template name, title, and body are required', 'error');
      return;
    }
    try {
      await apiClient('/admin/notification-templates', {
        method: 'POST',
        body: JSON.stringify({ name: templateName, titleTemplate, bodyTemplate }),
      });
      addToast('Template saved', 'success');
      setTemplateName('');
      setTitleTemplate('');
      setBodyTemplate('');
      apiClient<any>('/admin/notification-templates').then((res: any) => setTemplates(res?.data || res || []));
    } catch (_e) {
      addToast('Failed to save template', 'error');
    }
  };

  const handleSendCampaign = async (template: any) => {
    if (!window.confirm(`Send push campaign "${template.name}" to all active users?`)) return;
    try {
      const campRes: any = await apiClient('/admin/notifications/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: template.name,
          templateId: template._id || template.id,
          templateSnapshot: { titleTemplate: template.titleTemplate, bodyTemplate: template.bodyTemplate },
          audience: { mode: 'all' },
        }),
      });

      const campId = campRes?.campaign?._id || campRes?.campaign?.id || campRes?._id;
      if (campId) {
        setSendingCampaignId(campId);
        await apiClient(`/admin/notifications/campaigns/${campId}/send`, { method: 'POST' });
        addToast('Push campaign sent!', 'success');
        apiClient<any>('/admin/notifications/campaigns').then((res: any) => setCampaigns(res?.data || res || []));
      }
    } catch (_e) {
      addToast('Failed to send campaign', 'error');
    } finally {
      setSendingCampaignId(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Page title="Admin">
        <div className="py-20 flex flex-col items-center text-center px-5 gap-3">
          <ShieldAlert size={48} className="text-danger" />
          <h2 className="t-h2 text-[20px] font-bold text-text">Access Denied</h2>
          <p className="t-cap text-[13px] text-muted">Only administrators can access this dashboard.</p>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Admin Dashboard">
      <div className="flex flex-col gap-6 px-5 pt-2 pb-[140px]">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'users', label: 'Audience', icon: Users },
            { id: 'popups', label: 'Popups', icon: Layers },
            { id: 'notifications', label: 'Push Campaigns', icon: Megaphone },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as AdminTab)}
                className={`h-[38px] px-4 rounded-full flex items-center gap-2 t-cap text-[13px] font-bold transition-all flex-shrink-0 ${
                  isActive ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-2 text-muted'
                }`}
              >
                <Icon size={16} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="flex flex-col gap-6">
            {loadingStats ? (
              <div className="flex flex-col gap-4">
                <div className="h-[140px] rounded-[24px] bg-surface-2 animate-pulse" />
                <div className="h-[120px] rounded-[24px] bg-surface-2 animate-pulse" />
              </div>
            ) : stats ? (
              <div className="flex flex-col gap-6">
                {/* Platform Counts */}
                <div className="bg-surface p-5 rounded-[28px] border border-line flex flex-col gap-4 shadow-sm">
                  <div className="flex items-center gap-2 text-text font-bold t-h3">
                    <Database size={20} className="text-primary" />
                    <span>Database & Platform Counts</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-2 p-3.5 rounded-[18px] flex flex-col">
                      <span className="t-micro text-[11px] text-muted">Total Users</span>
                      <span className="t-h2 text-[24px] font-extrabold text-text">
                        {stats.counts?.users || 0}
                      </span>
                    </div>
                    <div className="bg-surface-2 p-3.5 rounded-[18px] flex flex-col">
                      <span className="t-micro text-[11px] text-muted">Song Catalog</span>
                      <span className="t-h2 text-[24px] font-extrabold text-text">
                        {stats.counts?.songs || 0}
                      </span>
                    </div>
                    <div className="bg-surface-2 p-3.5 rounded-[18px] flex flex-col">
                      <span className="t-micro text-[11px] text-muted">Listening Sessions</span>
                      <span className="t-h2 text-[24px] font-extrabold text-primary">
                        {stats.counts?.listeningSessions || 0}
                      </span>
                    </div>
                    <div className="bg-surface-2 p-3.5 rounded-[18px] flex flex-col">
                      <span className="t-micro text-[11px] text-muted">Active Popups</span>
                      <span className="t-h2 text-[24px] font-extrabold text-accent">
                        {stats.counts?.popups || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Songs */}
                {stats.topSongsByOurPlays?.length > 0 && (
                  <div className="bg-surface p-5 rounded-[28px] border border-line flex flex-col gap-3 shadow-sm">
                    <span className="t-h3 text-[16px] font-bold text-text">Top Songs by Stream Plays</span>
                    <div className="flex flex-col divide-y divide-line/20">
                      {stats.topSongsByOurPlays.map((song: any, idx: number) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-5 t-num text-[13px] font-bold text-muted text-center">
                              {idx + 1}
                            </span>
                            <span className="t-h3 text-[14px] font-bold text-text truncate">
                              {song.name}
                            </span>
                          </div>
                          <span className="t-cap text-[12px] text-muted font-semibold flex-shrink-0">
                            {song.plays || 0} plays
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* USERS / AUDIENCE TAB */}
        {tab === 'users' && (
          <div className="flex flex-col gap-4">
            <div className="relative w-full">
              <Input
                placeholder="Search users by name or email"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                icon={Search}
              />
            </div>

            {loadingUsers ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-[64px] rounded-[18px] bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="bg-surface rounded-[24px] border border-line divide-y divide-line/20 overflow-hidden">
                {userList.map((u: any) => (
                  <div key={u._id || u.id} className="p-4 flex items-center justify-between">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="t-h3 text-[15px] font-bold text-text truncate">{u.name}</span>
                        {u.role === 'admin' && (
                          <span className="bg-primary/20 text-primary t-micro text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <span className="t-cap text-[12.5px] text-muted truncate">{u.email}</span>
                    </div>

                    <span className="t-micro text-[11px] text-muted font-medium flex-shrink-0">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* POPUPS EDITOR TAB */}
        {tab === 'popups' && (
          <div className="flex flex-col gap-6">
            <div className="bg-surface p-5 rounded-[28px] border border-line flex flex-col gap-4 shadow-sm">
              <h2 className="t-h2 text-[18px] font-bold text-text">
                {editingPopup ? 'Edit Popup' : 'Create New Home Popup'}
              </h2>

              <Input
                label="Popup Name"
                placeholder="e.g. New Album Launch"
                value={popupName}
                onChange={(e) => setPopupName(e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="t-cap text-[12px] font-bold text-muted uppercase">HTML Content</label>
                <textarea
                  rows={5}
                  placeholder='<div style="text-align:center;"><h2>Special Offer</h2><button data-vinaraa-action="open-album" data-vinaraa-id="52424905">View Album</button></div>'
                  value={popupHtml}
                  onChange={(e) => setPopupHtml(e.target.value)}
                  className="w-full p-3 rounded-[16px] bg-surface-2 border border-line text-text t-body text-[14px] font-mono outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="t-cap text-[14px] font-semibold text-text">Enable on Home screen</span>
                <input
                  type="checkbox"
                  checked={popupEnabled}
                  onChange={(e) => setPopupEnabled(e.target.checked)}
                  className="w-6 h-6 accent-primary rounded-md"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button size="md" onClick={handleSavePopup} className="flex-1">
                  Save Popup
                </Button>
                {editingPopup && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setEditingPopup(null);
                      setPopupName('');
                      setPopupHtml('');
                      setPopupEnabled(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Existing Popups List */}
            <div className="flex flex-col gap-3">
              <h3 className="t-h3 text-[16px] font-bold text-text">Stored Popups</h3>
              <div className="flex flex-col gap-3">
                {popups.map((p) => {
                  const id = p._id || p.id;
                  return (
                    <div key={id} className="bg-surface p-4 rounded-[20px] border border-line flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="t-h3 text-[15px] font-bold text-text truncate">{p.name}</span>
                          {p.enabled && (
                            <span className="bg-success/20 text-success t-micro text-[10px] font-bold px-2 py-0.5 rounded-full">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <span className="t-cap text-[12px] text-muted truncate max-w-[240px]">
                          {p.html.replace(/<[^>]+>/g, '').slice(0, 60)}...
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingPopup(p);
                            setPopupName(p.name);
                            setPopupHtml(p.html);
                            setPopupEnabled(Boolean(p.enabled));
                          }}
                          className="w-9 h-9 rounded-full bg-surface-2 text-text flex items-center justify-center"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePopup(id)}
                          className="w-9 h-9 rounded-full bg-danger/15 text-danger flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS / CAMPAIGNS TAB */}
        {tab === 'notifications' && (
          <div className="flex flex-col gap-6">
            <div className="bg-surface p-5 rounded-[28px] border border-line flex flex-col gap-4 shadow-sm">
              <h2 className="t-h2 text-[18px] font-bold text-text">Create Notification Template</h2>

              <Input
                label="Template Name"
                placeholder="e.g. New Single Alert"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <Input
                label="Push Title"
                placeholder="Hi {{user.firstName}}, new song is out!"
                value={titleTemplate}
                onChange={(e) => setTitleTemplate(e.target.value)}
              />
              <Input
                label="Push Body"
                placeholder="Listen to the latest release on Vinaraa now."
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
              />

              <Button size="md" onClick={handleSaveTemplate} className="w-full mt-2">
                Save Template
              </Button>
            </div>

            {/* Templates List */}
            <div className="flex flex-col gap-3">
              <h3 className="t-h3 text-[16px] font-bold text-text">Saved Push Templates</h3>
              <div className="flex flex-col gap-3">
                {templates.map((tmpl) => {
                  const id = tmpl._id || tmpl.id;
                  return (
                    <div key={id} className="bg-surface p-4 rounded-[20px] border border-line flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="t-h3 text-[15px] font-bold text-text truncate">{tmpl.name}</span>
                        <span className="t-cap text-[12px] text-muted truncate">{tmpl.titleTemplate}</span>
                      </div>

                      <Button
                        size="sm"
                        loading={sendingCampaignId === id}
                        onClick={() => handleSendCampaign(tmpl)}
                        className="flex-shrink-0"
                      >
                        <Send size={14} className="mr-1" />
                        <span>Send All</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Campaign Logs */}
            {campaigns.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="t-h3 text-[16px] font-bold text-text">Sent Campaign History</h3>
                <div className="bg-surface rounded-[24px] border border-line divide-y divide-line/20 overflow-hidden">
                  {campaigns.map((camp) => (
                    <div key={camp._id || camp.id} className="p-4 flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <span className="t-h3 text-[14px] font-bold text-text truncate">{camp.name}</span>
                        <span className="t-cap text-[12px] text-muted">
                          {camp.recipientCount || 0} recipients · {new Date(camp.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`t-micro text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        camp.status === 'sent' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                      }`}>
                        {camp.status?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
