import { Download, BarChart3, PieChart, FileText } from 'lucide-react';
import type { ScanHistoryItem, ScanRecordResponse } from '../../types';
import { apiRequest } from '../../lib/api';
import { generateAndDownloadScanPdf } from '../../lib/pdfReport';

interface AnalyticsOverviewData {
  totals: {
    totalScans: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  recentScans: ScanHistoryItem[];
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

interface AnalyticsReportsViewProps {
  overview: AnalyticsOverviewData | null;
  onStartScan: (tab: string) => void;
}

export function AnalyticsReportsView({ overview, onStartScan }: AnalyticsReportsViewProps) {
  const totals = overview?.totals || { totalScans: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 };
  const total = Math.max(1, totals.totalScans);
  const byType = overview?.byType || [];
  const trendByDay = overview?.trendByDay || [];
  const recentScans = overview?.recentScans || [];

  const handleDownloadScan = async (scanId: string) => {
    const full = await apiRequest<ScanRecordResponse<any>>(`/api/scans/${scanId}`);
    await generateAndDownloadScanPdf({
      scanId: full.scanId,
      scanType: full.scanType || 'job',
      createdAt: full.createdAt,
      subjectTitle: full.subjectTitle || 'Scan Report',
      companyName: full.companyName,
      result: full.result,
      isAuthenticated: true,
    });
  };

  if (totals.totalScans === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-12 text-center space-y-4">
        <BarChart3 className="w-10 h-10 text-blue-400 mx-auto" />
        <h3 className="text-lg font-semibold text-white">No Scan Analytics Yet</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Run your first job, email, URL, or company verification scan to populate real database charts and downloadable PDF reports.
        </p>
        <button
          type="button"
          onClick={() => onStartScan('job-detector')}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
        >
          Run First Job Scan
        </button>
      </div>
    );
  }

  const maxDayTotal = Math.max(1, ...trendByDay.map((d) => d.total));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Reports & Analytics</h2>
        <p className="text-sm text-slate-400 mt-1">
          Live charts calculated directly from your persisted scan records, plus one-click PDF report downloads.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Category Distribution */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-400" />
              Risk Category Distribution
            </h3>
            <span className="text-xs text-slate-400 font-mono-data">{totals.totalScans} total scans</span>
          </div>

          <div className="space-y-4">
            {[
              { label: 'High Risk (61–100)', count: totals.highRisk, color: 'bg-red-500', text: 'text-red-400' },
              { label: 'Medium Risk (31–60)', count: totals.mediumRisk, color: 'bg-amber-500', text: 'text-amber-400' },
              { label: 'Low Risk (0–30)', count: totals.lowRisk, color: 'bg-emerald-500', text: 'text-emerald-400' },
            ].map((row) => {
              const pct = Math.round((row.count / total) * 100);
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{row.label}</span>
                    <span className={`font-mono-data font-semibold ${row.text}`}>
                      {row.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scan Breakdown by Scanner Type */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Detection Breakdown by Scan Type
            </h3>
            <span className="text-xs text-slate-400">Average Score & High-Risk Count</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {byType.map((item) => (
              <div key={item.scanType} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white capitalize">{item.scanType} Scanner</div>
                  <div className="text-xs text-slate-400 font-mono-data">
                    {item.count} scan(s) · {item.highRiskCount} high-risk
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono-data text-base font-semibold text-blue-400">{item.avgScore ?? 0}/100</div>
                  <div className="text-xs text-slate-500">Avg Risk</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Scanning & Detection Trends (Real DB Series) */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Scan & Threat Detection Activity by Date</h3>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" /> Total Scans
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-500 inline-block" /> Job/Email High Risk
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-cyan-400 inline-block" /> URL Checks
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 pt-2">
          {trendByDay.map((d) => {
            const totalPct = Math.max(12, Math.round((d.total / maxDayTotal) * 100));
            const highRiskSum = d.jobHighRisk + d.emailHighRisk;
            const highPct = d.total > 0 ? Math.round((highRiskSum / maxDayTotal) * 100) : 0;
            return (
              <div key={d.day} className="flex flex-col items-center space-y-2">
                <div className="w-full h-32 rounded-lg bg-[#070C18] border border-slate-800/70 p-2 flex items-end justify-center gap-1.5">
                  <div
                    className="w-3 bg-blue-500 rounded-t transition-all duration-500"
                    style={{ height: `${totalPct}%` }}
                    title={`Total scans: ${d.total}`}
                  />
                  {highRiskSum > 0 && (
                    <div
                      className="w-3 bg-red-500 rounded-t transition-all duration-500"
                      style={{ height: `${Math.max(10, highPct)}%` }}
                      title={`High risk jobs/emails: ${highRiskSum}`}
                    />
                  )}
                  {d.urlScans > 0 && (
                    <div
                      className="w-3 bg-cyan-400 rounded-t transition-all duration-500"
                      style={{ height: `${Math.max(10, Math.round((d.urlScans / maxDayTotal) * 100))}%` }}
                      title={`URL checks: ${d.urlScans}`}
                    />
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono-data">{d.day.slice(5)}</span>
                <span className="text-xs text-white font-mono-data">{d.total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Downloadable PDF Reports Archive */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Exportable PDF Reports
          </h3>
          <span className="text-xs text-slate-400">Recent Scans</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {recentScans.map((scan) => (
            <div key={scan.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{scan.jobOrCompanyName}</p>
                <p className="text-xs text-slate-400 font-mono-data">
                  {scan.scanType.toUpperCase()} · Score {scan.riskScore}/100 ({scan.riskClassification}) ·{' '}
                  {new Date(scan.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadScan(scan.scanId)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:border-blue-500 transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
