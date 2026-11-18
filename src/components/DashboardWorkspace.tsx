import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  FileSearch,
  Mail,
  Globe,
  Building2,
  History,
  BarChart3,
  User as UserIcon,
  Settings,
  Flag,
  BookOpen,
  ShieldAlert,
  Bell,
  MessageSquare,
  Menu,
  X,
  ArrowLeft,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import type { User, ScanHistoryItem, NotificationItem } from '../types';
import { apiRequest } from '../lib/api';
import { JobScamDetector } from './scanners/JobScamDetector';
import { EmailScanner } from './scanners/EmailScanner';
import { UrlScanner } from './scanners/UrlScanner';
import { CompanyVerifier } from './scanners/CompanyVerifier';
import { ScanHistoryView } from './dashboard/ScanHistoryView';
import { AnalyticsReportsView } from './dashboard/AnalyticsReportsView';
import { ProfileView } from './dashboard/ProfileView';
import { ProfileSettingsView } from './dashboard/ProfileSettingsView';
import { AdminDashboardView } from './dashboard/AdminDashboardView';
import { CommunityReportsView } from './CommunityReportsView';
import { LearnScamsSection } from './LearnScamsSection';

interface DashboardOverviewData {
  totals: {
    totalScans: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  recentScans: Array<ScanHistoryItem & { subjectTitle?: string; companyName?: string }>;
  byType: Array<{
    scanType: string;
    count: number;
    avgScore: number;
    highRiskCount: number;
  }>;
  trendByDay: Array<{
    day: string;
    total: number;
    jobHighRisk: number;
    emailHighRisk: number;
    urlScans: number;
  }>;
}

interface DashboardWorkspaceProps {
  user: User;
  initialTab?: string;
  onUserUpdated: (user: User) => void;
  onSignedOut: () => void;
  onBackToLanding: () => void;
  onOpenAssistant: (context?: string) => void;
}

export function DashboardWorkspace({
  user,
  initialTab = 'overview',
  onUserUpdated,
  onSignedOut,
  onBackToLanding,
  onOpenAssistant,
}: DashboardWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [ov, notif] = await Promise.all([
        apiRequest<DashboardOverviewData>('/api/dashboard/overview'),
        apiRequest<{ items: NotificationItem[] }>('/api/notifications'),
      ]);
      setOverview(ov);
      setNotifications(notif.items);
    } catch {
      // handled cleanly
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const unreadCount = notifications.filter((n) => n.isRead === 0).length;

  const markNotifRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: 1 } : n)));
  };

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
  };

  const navItems = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'job-detector', label: 'Job Scam Detector', Icon: FileSearch },
    { id: 'email-scanner', label: 'Email Scanner', Icon: Mail },
    { id: 'url-checker', label: 'URL Checker', Icon: Globe },
    { id: 'company-verifier', label: 'Company Verification', Icon: Building2 },
    { id: 'scan-history', label: 'Scan History', Icon: History },
    { id: 'reports', label: 'Reports', Icon: BarChart3 },
    { id: 'community-reports', label: 'Community Reports', Icon: Flag },
    { id: 'learn', label: 'Learn About Scams', Icon: BookOpen },
    { id: 'profile', label: 'Profile', Icon: UserIcon },
    { id: 'settings', label: 'Settings', Icon: Settings },
    ...(user.role === 'admin' ? [{ id: 'admin', label: 'Admin Console', Icon: ShieldAlert }] : []),
  ];

  const activeNavLabel = navItems.find((i) => i.id === activeTab)?.label || 'Overview';

  const selectTab = (id: string) => {
    setActiveTab(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-slate-800 bg-[#0B1222] shrink-0">
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-2.5 text-base font-bold text-white whitespace-nowrap"
          >
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            <span>ScamShield</span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600/15 text-white border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={onBackToLanding}
            className="w-full flex items-center gap-2 rounded-lg border border-slate-800 bg-[#070C18] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Public Home
          </button>
          <button
            type="button"
            onClick={async () => {
              await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
              localStorage.removeItem('scamshield_session_token');
              onSignedOut();
            }}
            className="w-full flex items-center gap-2 rounded-lg border border-slate-800 bg-[#070C18] px-3 py-2 text-xs font-medium text-slate-300 hover:text-red-300 hover:border-red-500/30"
          >
            <X className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-[#0B1222] border-r border-slate-800 flex flex-col h-full z-10">
            <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-bold text-white">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
                ScamShield
              </span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                      active ? 'bg-blue-600/15 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800 bg-[#070C18]/90 backdrop-blur-xs flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-400 truncate">
              <span>Workspace</span>
              <span aria-hidden="true" className="mx-2">/</span>
              <span className="text-white font-medium">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAssistant()}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1528] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500/60"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              Assistant
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg border border-slate-800 bg-[#0D1528] text-slate-300 hover:text-white"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-[10px] font-mono-data font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-800 bg-[#0D1528] shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No notifications yet.</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markNotifRead(n.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-800/40 transition-colors ${
                            n.isRead === 0 ? 'bg-blue-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white">{n.title}</span>
                            <span className="text-[11px] font-mono-data text-slate-500">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => selectTab('profile')}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0D1528] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700"
            >
              <img
                src="/src/assets/images/avatar_security_lead_1794721249716.jpg"
                alt={user.fullName}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="hidden md:inline max-w-[120px] truncate">{user.fullName}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Welcome back, {user.fullName}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    Your personal recruitment safety overview and recent analysis activity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectTab('job-detector')}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap self-start sm:self-auto"
                >
                  New Job Scam Scan
                </button>
              </div>

              {/* 4 Overview KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
                  <div className="text-xs text-slate-400">Total Scans Performed</div>
                  <div className="font-mono-data text-3xl font-bold text-white mt-2">
                    {loadingOverview ? '—' : overview?.totals.totalScans ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
                  <div className="text-xs text-slate-400">High-Risk Detected</div>
                  <div className="font-mono-data text-3xl font-bold text-red-400 mt-2">
                    {loadingOverview ? '—' : overview?.totals.highRisk ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
                  <div className="text-xs text-slate-400">Medium-Risk Detected</div>
                  <div className="font-mono-data text-3xl font-bold text-amber-400 mt-2">
                    {loadingOverview ? '—' : overview?.totals.mediumRisk ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-5">
                  <div className="text-xs text-slate-400">Low-Risk Detected</div>
                  <div className="font-mono-data text-3xl font-bold text-emerald-400 mt-2">
                    {loadingOverview ? '—' : overview?.totals.lowRisk ?? 0}
                  </div>
                </div>
              </div>

              {/* Quick Launch Scanners */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(
                  [
                    { id: 'job-detector', title: 'Job Scam Detector', desc: 'Inspect job posts across 12 risk signals', Icon: FileSearch },
                    { id: 'email-scanner', title: 'Email Scanner', desc: 'Detect phishing & fake offer letters', Icon: Mail },
                    { id: 'url-checker', title: 'URL Checker', desc: 'Check application domains & redirects', Icon: Globe },
                    { id: 'company-verifier', title: 'Company Check', desc: 'Verify DNS, MX, RDAP & email match', Icon: Building2 },
                  ] as const
                ).map(({ id, title, desc, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className="text-left rounded-xl border border-slate-800 bg-[#0D1528] p-5 hover:border-blue-500/50 transition-colors space-y-2"
                  >
                    <Icon className="w-5 h-5 text-blue-400" />
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="text-xs text-slate-400">{desc}</div>
                  </button>
                ))}
              </div>

              {/* Recent Activity Table */}
              <div className="rounded-xl border border-slate-800 bg-[#0D1528] overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
                  <button
                    type="button"
                    onClick={() => selectTab('scan-history')}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300"
                  >
                    View All History
                  </button>
                </div>

                {loadingOverview ? (
                  <div className="p-8 flex items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading recent activity...
                  </div>
                ) : !overview || overview.recentScans.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-sm text-slate-400">
                      You have not saved any scans yet. Run a Job, Email, URL, or Company scan to see your activity here.
                    </p>
                    <button
                      type="button"
                      onClick={() => selectTab('job-detector')}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                    >
                      Start Your First Scan
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs text-slate-400">
                          <th className="py-3 px-5">Job Title / Target</th>
                          <th className="py-3 px-5">Company / Entity</th>
                          <th className="py-3 px-5">Scan Date</th>
                          <th className="py-3 px-5 text-right">Risk Score</th>
                          <th className="py-3 px-5">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-sm">
                        {overview.recentScans.map((scan) => {
                          const riskColor =
                            scan.riskClassification === 'High Risk'
                              ? 'text-red-400'
                              : scan.riskClassification === 'Medium Risk'
                                ? 'text-amber-400'
                                : 'text-emerald-400';
                          return (
                            <tr
                              key={scan.id}
                              onClick={() => selectTab('scan-history')}
                              className="hover:bg-slate-900/50 cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-5 font-medium text-white max-w-xs truncate">
                                {scan.subjectTitle || scan.jobOrCompanyName}
                              </td>
                              <td className="py-3 px-5 text-slate-300 max-w-xs truncate">
                                {scan.companyName || '—'}
                              </td>
                              <td className="py-3 px-5 font-mono-data text-xs text-slate-400 whitespace-nowrap">
                                {new Date(scan.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-5 text-right font-mono-data font-semibold text-white">
                                {scan.riskScore}
                              </td>
                              <td className={`py-3 px-5 text-xs font-medium whitespace-nowrap ${riskColor}`}>
                                {scan.riskClassification}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'job-detector' && (
            <JobScamDetector
              isAuthenticated={true}
              onScanComplete={loadDashboardData}
              onAskAssistant={(ctx) => onOpenAssistant(ctx)}
            />
          )}

          {activeTab === 'email-scanner' && (
            <EmailScanner
              isAuthenticated={true}
              onScanComplete={loadDashboardData}
              onAskAssistant={(ctx) => onOpenAssistant(ctx)}
            />
          )}

          {activeTab === 'url-checker' && (
            <UrlScanner isAuthenticated={true} onScanComplete={loadDashboardData} />
          )}

          {activeTab === 'company-verifier' && (
            <CompanyVerifier isAuthenticated={true} onScanComplete={loadDashboardData} />
          )}

          {activeTab === 'scan-history' && (
            <ScanHistoryView onHistoryMutated={loadDashboardData} />
          )}

          {activeTab === 'reports' && (
            <AnalyticsReportsView overview={overview} onStartScan={selectTab} />
          )}

          {activeTab === 'community-reports' && <CommunityReportsView />}

          {activeTab === 'learn' && <LearnScamsSection />}

          {activeTab === 'profile' && (
            <ProfileView
              user={user}
              totals={overview?.totals}
              onUserUpdated={onUserUpdated}
              onProfileSaved={loadDashboardData}
              onOpenSettings={() => selectTab('settings')}
            />
          )}

          {activeTab === 'settings' && (
            <ProfileSettingsView
              user={user}
              onUserUpdated={onUserUpdated}
              onSignedOut={onSignedOut}
            />
          )}

          {activeTab === 'admin' && user.role === 'admin' && <AdminDashboardView />}
        </main>
      </div>
    </div>
  );
}
