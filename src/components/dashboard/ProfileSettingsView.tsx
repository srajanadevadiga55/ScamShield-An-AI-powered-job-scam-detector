import { useState, useEffect } from 'react';
import { Save, KeyRound, LogOut, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { apiRequest, setStoredToken } from '../../lib/api';
import type { User } from '../../types';

interface ProfileSettingsViewProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onSignedOut: () => void;
}

export function ProfileSettingsView({
  user,
  onUserUpdated,
  onSignedOut,
}: ProfileSettingsViewProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [jobSearchStatus, setJobSearchStatus] = useState(user.jobSearchStatus || 'Actively Applying');
  const [notifyHighRisk, setNotifyHighRisk] = useState(user.preferences?.notifyHighRisk ?? true);
  const [notifyReports, setNotifyReports] = useState(user.preferences?.notifyReports ?? true);
  const [emailDigest, setEmailDigest] = useState(user.preferences?.emailDigest ?? false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setFullName(user.fullName);
    setEmail(user.email);
    setJobSearchStatus(user.jobSearchStatus || 'Actively Applying');
    setNotifyHighRisk(user.preferences?.notifyHighRisk ?? true);
    setNotifyReports(user.preferences?.notifyReports ?? true);
    setEmailDigest(user.preferences?.emailDigest ?? false);
  }, [user]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteBox, setShowDeleteBox] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          email,
          jobSearchStatus,
          preferences: { notifyHighRisk, notifyReports, emailDigest },
        }),
      });
      setStoredToken(res.token);
      onUserUpdated(res.user);
      setProfileMsg({ type: 'success', text: 'Profile and preferences updated successfully.' });
    } catch (err) {
      setProfileMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    setSavingPassword(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwdMsg({ type: 'success', text: res.message });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwdMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not change password.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await apiRequest('/api/profile', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      setStoredToken(null);
      onSignedOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Account deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-white">Profile & Settings</h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage your account details, notification preferences, password, and data removal options.
        </p>
      </div>

      {/* Profile & Notification Preferences */}
      <form onSubmit={handleSaveProfile} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <img
            src="/src/assets/images/avatar_security_lead_1794721249716.jpg"
            alt={user.fullName}
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-full object-cover border border-slate-700"
          />
          <div>
            <h3 className="text-base font-semibold text-white">{user.fullName}</h3>
            <p className="text-xs text-slate-400">
              {user.email} · Role: <span className="capitalize text-slate-200">{user.role}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Job Search Status</label>
          <select
            value={jobSearchStatus}
            onChange={(e) => setJobSearchStatus(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option>Actively Applying</option>
            <option>Student / Recent Graduate</option>
            <option>Evaluating Offer Letters</option>
            <option>Passive / Career Monitoring</option>
            <option>Platform Administrator</option>
          </select>
        </div>

        <div className="border-t border-slate-800 pt-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">Notification Preferences</h4>
          <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyHighRisk}
              onChange={(e) => setNotifyHighRisk(e.target.checked)}
              className="rounded border-slate-600 bg-[#070C18] text-blue-600"
            />
            Alert me in-app when a scan detects High-Risk indicators
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyReports}
              onChange={(e) => setNotifyReports(e.target.checked)}
              className="rounded border-slate-600 bg-[#070C18] text-blue-600"
            />
            Confirm when downloadable PDF reports are generated
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={emailDigest}
              onChange={(e) => setEmailDigest(e.target.checked)}
              className="rounded border-slate-600 bg-[#070C18] text-blue-600"
            />
            Receive weekly fraud trend summaries (when email relay is configured)
          </label>
        </div>

        {profileMsg && (
          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
              profileMsg.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            {profileMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Profile Changes
          </button>
        </div>
      </form>

      {/* Password Update */}
      <form onSubmit={handleChangePassword} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-400" />
          Change Password
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 chars, letters + numbers"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {pwdMsg && (
          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
              pwdMsg.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            <span>{pwdMsg.text}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Update Password
          </button>
        </div>
      </form>

      {/* Sign Out & Account Deletion */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">Session & Data Removal</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sign out of this device or permanently delete your account and personal scan history.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
                setStoredToken(null);
                onSignedOut();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>

            {user.role !== 'admin' && (
              <button
                type="button"
                onClick={() => setShowDeleteBox(!showDeleteBox)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
            )}
          </div>
        </div>

        {showDeleteBox && (
          <form onSubmit={handleDeleteAccount} className="pt-4 border-t border-slate-800 space-y-3">
            <p className="text-xs text-red-300">
              This action permanently deletes your profile, saved scan history, and notifications. Enter your password to confirm.
            </p>
            {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Confirm your password"
                className="flex-1 rounded-lg border border-red-500/30 bg-[#070C18] px-3.5 py-2 text-sm text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
