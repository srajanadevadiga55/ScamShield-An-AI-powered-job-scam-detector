import { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  ShieldCheck,
  Calendar,
  Briefcase,
  BellRing,
  FileCheck2,
  MailCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
} from 'lucide-react';
import { apiRequest, setStoredToken } from '../../lib/api';
import type { User } from '../../types';

interface ProfileViewProps {
  user: User;
  totals?: {
    totalScans: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  onUserUpdated: (user: User) => void;
  onProfileSaved?: () => void;
  onOpenSettings: () => void;
}

export function ProfileView({
  user,
  totals,
  onUserUpdated,
  onProfileSaved,
  onOpenSettings,
}: ProfileViewProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [jobSearchStatus, setJobSearchStatus] = useState(user.jobSearchStatus || 'Actively Applying');

  const [notifyHighRisk, setNotifyHighRisk] = useState(user.preferences?.notifyHighRisk ?? true);
  const [notifyReports, setNotifyReports] = useState(user.preferences?.notifyReports ?? true);
  const [emailDigest, setEmailDigest] = useState(user.preferences?.emailDigest ?? false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setFullName(user.fullName);
    setEmail(user.email);
    setJobSearchStatus(user.jobSearchStatus || 'Actively Applying');
    setNotifyHighRisk(user.preferences?.notifyHighRisk ?? true);
    setNotifyReports(user.preferences?.notifyReports ?? true);
    setEmailDigest(user.preferences?.emailDigest ?? false);
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);

    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          jobSearchStatus,
          preferences: {
            notifyHighRisk,
            notifyReports,
            emailDigest,
          },
        }),
      });
      setStoredToken(res.token);
      onUserUpdated(res.user);
      onProfileSaved?.();
      setFeedback({
        type: 'success',
        text: 'Account details and security alert notification preferences saved.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update profile settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Active Member';

  const alertPreferences = [
    {
      id: 'notify-high-risk',
      title: 'High-Risk Security Alerts',
      description:
        'Send an immediate in-app security warning whenever a job, email, URL, or company scan scores High Risk (61–100).',
      checked: notifyHighRisk,
      onToggle: () => setNotifyHighRisk((prev) => !prev),
      Icon: BellRing,
      badge: notifyHighRisk ? 'Active' : 'Paused',
    },
    {
      id: 'notify-reports',
      title: 'Safety Report Confirmations',
      description:
        'Record an activity notification whenever you generate and download a PDF safety audit report.',
      checked: notifyReports,
      onToggle: () => setNotifyReports((prev) => !prev),
      Icon: FileCheck2,
      badge: notifyReports ? 'Active' : 'Off',
    },
    {
      id: 'notify-email-digest',
      title: 'Weekly Fraud & Phishing Digest',
      description:
        'Receive weekly recruitment scam advisories and emerging threat summaries (delivered when SMTP email is enabled).',
      checked: emailDigest,
      onToggle: () => setEmailDigest((prev) => !prev),
      Icon: MailCheck,
      badge: emailDigest ? 'Subscribed' : 'Off',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Account Profile</h2>
          <p className="text-sm text-slate-400 mt-1">
            Review your ScamShield account identity and customize how you receive security alerts.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1528] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-blue-500/50 hover:text-white transition-colors self-start sm:self-auto"
        >
          <Settings className="w-3.5 h-3.5 text-blue-400" />
          Password & Security Settings
        </button>
      </div>

      {/* Account Overview Header Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <img
              src="/src/assets/images/avatar_security_lead_1794721249716.jpg"
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border border-blue-500/40"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-white">{user.fullName}</h3>
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300 capitalize">
                  {user.role === 'admin' ? 'Administrator' : 'Job Seeker'}
                </span>
                {user.emailVerified !== false && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                    <ShieldCheck className="w-3 h-3" />
                    Email Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
            <div className="rounded-lg border border-slate-800 bg-[#070C18] px-3 py-2">
              <div className="text-[11px] text-slate-400">Total Scans</div>
              <div className="font-mono-data text-base font-semibold text-white mt-0.5">
                {totals?.totalScans ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#070C18] px-3 py-2">
              <div className="text-[11px] text-slate-400">High Risk</div>
              <div className="font-mono-data text-base font-semibold text-red-400 mt-0.5">
                {totals?.highRisk ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#070C18] px-3 py-2">
              <div className="text-[11px] text-slate-400">Low Risk</div>
              <div className="font-mono-data text-base font-semibold text-emerald-400 mt-0.5">
                {totals?.lowRisk ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-2.5 rounded-lg border border-slate-800/80 bg-[#070C18] p-3">
            <UserIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-slate-400">Account ID</div>
              <div className="font-mono-data text-slate-200 truncate mt-0.5" title={user.id}>
                {user.id}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-slate-800/80 bg-[#070C18] p-3">
            <Calendar className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-slate-400">Member Since</div>
              <div className="text-slate-200 font-medium mt-0.5">{memberSince}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-slate-800/80 bg-[#070C18] p-3">
            <Briefcase className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-slate-400">Search Focus</div>
              <div className="text-slate-200 font-medium mt-0.5">{jobSearchStatus}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Account Details + Security Alert Preferences */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-white">Account Details</h3>
            <p className="text-xs text-slate-400 mt-1">
              Keep your display name, contact email, and job search status up to date.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#070C18] pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#070C18] pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
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
        </div>

        {/* Security Alert Notification Preferences */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-white">Security Alert Preferences</h3>
            <p className="text-xs text-slate-400 mt-1">
              Control which security alerts and activity notifications ScamShield delivers to your workspace.
            </p>
          </div>

          <div className="divide-y divide-slate-800/80">
            {alertPreferences.map(({ id, title, description, checked, onToggle, Icon, badge }) => (
              <div key={id} className="py-4 first:pt-1 last:pb-1 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg border border-slate-800 bg-[#070C18] text-blue-400 shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{title}</span>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          checked
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                            : 'border-slate-700 bg-slate-800/60 text-slate-400'
                        }`}
                      >
                        {badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">{description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={title}
                  onClick={onToggle}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${
                    checked
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      checked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                feedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Profile & Alert Preferences
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
