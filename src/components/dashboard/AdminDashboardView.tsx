import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  Activity,
  Server,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface AdminOverview {
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: number;
    scanCount: number;
    createdAt: string;
  }>;
  scanStats: {
    totalScans: number;
    highRisk: number | null;
    mediumRisk: number | null;
    lowRisk: number | null;
  };
  scansByType: Array<{ scanType: string; count: number }>;
  reports: Array<{
    id: string;
    jobTitle: string;
    companyName: string;
    scamType: string;
    platformSource: string;
    status: 'pending' | 'verified' | 'dismissed';
    upvotes: number;
    description: string;
    createdAt: string;
  }>;
  feedbackList: Array<{
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    status: 'new' | 'reviewed' | 'resolved';
    createdAt: string;
  }>;
  threatSources: Array<{
    id: string;
    name: string;
    providerType: string;
    isEnabled: boolean;
    apiKeyConfigured: boolean;
    description: string;
  }>;
  systemErrors: Array<{
    id: string;
    endpoint: string;
    errorMessage: string;
    severity: string;
    createdAt: string;
  }>;
  database?: {
    engine: string;
    connected: boolean;
  };
  aiService: {
    provider: string;
    model: string;
    configured: boolean;
    fallbackMode: string;
  };
}

export function AdminDashboardView() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'intel' | 'feedback' | 'errors'>('users');

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminOverview>('/api/admin/overview');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const updateReportStatus = async (id: string, status: 'verified' | 'dismissed') => {
    await apiRequest(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadAdmin();
  };

  const toggleThreatSource = async (id: string, isEnabled: boolean) => {
    await apiRequest(`/api/admin/threat-sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled }),
    });
    await loadAdmin();
  };

  const toggleUserActive = async (id: string, isActive: boolean) => {
    await apiRequest(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    await loadAdmin();
  };

  const updateFeedbackStatus = async (id: string, status: 'reviewed' | 'resolved') => {
    await apiRequest(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadAdmin();
  };

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading administrator telemetry...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 flex items-center gap-3 text-sm text-red-300">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error || 'Administrator data unavailable.'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Administrator Console</h2>
        <p className="text-sm text-slate-400 mt-1">
          Platform-wide scan statistics, registered users, suspicious report moderation, threat intelligence feeds, AI service status, and system error logs.
        </p>
      </div>

      {/* Platform KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Registered Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono-data text-2xl font-bold text-white mt-2">{data.users.length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Platform Scans</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono-data text-2xl font-bold text-white mt-2">{data.scanStats.totalScans || 0}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>High-Risk Detections</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="font-mono-data text-2xl font-bold text-red-400 mt-2">{data.scanStats.highRisk || 0}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>AI Service Status</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-white mt-2">
            {data.aiService.configured ? 'Gemini API Active' : 'Fallback Engine Active'}
          </div>
          <div className="text-xs text-slate-400 font-mono-data mt-0.5">{data.aiService.model}</div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0D1528] border border-slate-800 w-fit">
        {(
          [
            { id: 'users', label: `Users (${data.users.length})` },
            { id: 'reports', label: `Scam Reports (${data.reports.length})` },
            { id: 'intel', label: 'Threat Intelligence & AI' },
            { id: 'feedback', label: `Feedback (${data.feedbackList.length})` },
            { id: 'errors', label: `System Errors (${data.systemErrors.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Scans</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{u.fullName}</div>
                    <div className="text-xs text-slate-400 font-mono-data">{u.email}</div>
                  </td>
                  <td className="py-3 px-4 capitalize text-xs text-slate-300">{u.role}</td>
                  <td className="py-3 px-4 text-right font-mono-data text-slate-200">{u.scanCount}</td>
                  <td className="py-3 px-4 font-mono-data text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className={u.isActive ? 'text-emerald-400' : 'text-red-400'}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => toggleUserActive(u.id, !u.isActive)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-3">
          {data.reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-[#0D1528] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-slate-400">
                  {r.scamType} · {r.platformSource} · Status:{' '}
                  <span className={r.status === 'verified' ? 'text-emerald-400' : r.status === 'dismissed' ? 'text-red-400' : 'text-amber-400'}>
                    {r.status}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white">
                  {r.jobTitle} — {r.companyName}
                </h4>
                <p className="text-xs text-slate-300 max-w-2xl">{r.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => updateReportStatus(r.id, 'verified')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30"
                >
                  <Check className="w-3.5 h-3.5" /> Verify
                </button>
                <button
                  type="button"
                  onClick={() => updateReportStatus(r.id, 'dismissed')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/20 border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-600/30"
                >
                  <X className="w-3.5 h-3.5" /> Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'intel' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white">AI &amp; Database Infrastructure Telemetry</h3>
            <p className="text-xs text-slate-300">
              Provider: {data.aiService.provider} · Model: <span className="font-mono-data">{data.aiService.model}</span> · Status:{' '}
              <span className={data.aiService.configured ? 'text-emerald-400' : 'text-amber-400'}>
                {data.aiService.fallbackMode}
              </span>
            </p>
            {data.database && (
              <p className="text-xs text-slate-300">
                Database: <span className="font-mono-data text-blue-300">{data.database.engine}</span> · Connection:{' '}
                <span className={data.database.connected ? 'text-emerald-400' : 'text-red-400'}>
                  {data.database.connected ? 'Connected' : 'Disconnected'}
                </span>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1528] divide-y divide-slate-800">
            {data.threatSources.map((src) => (
              <div key={src.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{src.name}</h4>
                    <span className="text-xs text-slate-400">· {src.providerType}</span>
                  </div>
                  <p className="text-xs text-slate-400">{src.description}</p>
                  <p className="text-xs font-mono-data text-slate-500">
                    Key Status: {src.apiKeyConfigured ? 'Ready' : 'Environment key not set'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleThreatSource(src.id, !src.isEnabled)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto ${
                    src.isEnabled
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  {src.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-3">
          {data.feedbackList.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-8 text-center text-sm text-slate-400">
              No contact or feedback messages submitted yet.
            </div>
          ) : (
            data.feedbackList.map((fb) => (
              <div key={fb.id} className="rounded-xl border border-slate-800 bg-[#0D1528] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">
                    {fb.name} ({fb.email}) · Status: <span className="text-blue-400 capitalize">{fb.status}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{fb.subject}</h4>
                  <p className="text-xs text-slate-300">{fb.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateFeedbackStatus(fb.id, 'reviewed')}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    Mark Reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFeedbackStatus(fb.id, 'resolved')}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5 space-y-3">
          {data.systemErrors.length === 0 ? (
            <p className="text-sm text-slate-400">No recorded server errors.</p>
          ) : (
            data.systemErrors.map((err) => (
              <div key={err.id} className="border-b border-slate-800/80 pb-3 last:border-b-0 last:pb-0 text-xs">
                <div className="flex items-center justify-between text-slate-400 font-mono-data">
                  <span className="text-red-400">{err.endpoint}</span>
                  <span>{new Date(err.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-200 mt-1">{err.errorMessage}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
