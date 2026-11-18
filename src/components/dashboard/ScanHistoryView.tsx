import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Trash2,
  Eye,
  Download,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { generateAndDownloadScanPdf } from '../../lib/pdfReport';
import type { ScanHistoryItem, ScanRecordResponse } from '../../types';
import { RiskScoreGauge } from '../RiskScoreGauge';

interface ScanHistoryViewProps {
  onHistoryMutated?: () => void;
}

export function ScanHistoryView({ onHistoryMutated }: ScanHistoryViewProps) {
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const [selectedReport, setSelectedReport] = useState<ScanRecordResponse<any> | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (riskFilter) params.set('risk', riskFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await apiRequest<{ items: ScanHistoryItem[] }>(
        `/api/scans/history?${params.toString()}`
      );
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load scan history.');
    } finally {
      setLoading(false);
    }
  }, [search, riskFilter, typeFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleOpenReport = async (scanId: string) => {
    setLoadingReport(true);
    try {
      const full = await apiRequest<ScanRecordResponse<any>>(`/api/scans/${scanId}`);
      setSelectedReport(full);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open scan report.');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDeleteOne = async (scanId: string) => {
    try {
      await apiRequest(`/api/scans/history/${scanId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.scanId !== scanId));
      onHistoryMutated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record.');
    }
  };

  const handleClearAll = async () => {
    try {
      await apiRequest('/api/scans/history', { method: 'DELETE' });
      setItems([]);
      setConfirmClear(false);
      onHistoryMutated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear scan history.');
    }
  };

  const handleDownload = async (report: ScanRecordResponse<any>) => {
    await generateAndDownloadScanPdf({
      scanId: report.scanId,
      scanType: report.scanType || 'job',
      createdAt: report.createdAt,
      subjectTitle: report.subjectTitle || 'Scan Report',
      companyName: report.companyName,
      result: report.result,
      isAuthenticated: true,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Scan History</h2>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, review full reports, export PDFs, or remove previous scan records.
          </p>
        </div>

        {items.length > 0 && (
          <div className="shrink-0">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Confirm Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job, company, or summary..."
            className="w-full rounded-lg border border-slate-800 bg-[#0D1528] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-[#0D1528] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Risk Categories</option>
          <option value="High Risk">High Risk (61–100)</option>
          <option value="Medium Risk">Medium Risk (31–60)</option>
          <option value="Low Risk">Low Risk (0–30)</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-[#0D1528] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Scan Types</option>
          <option value="job">Job Posting</option>
          <option value="email">Recruitment Email</option>
          <option value="url">Application URL</option>
          <option value="company">Company Verification</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading scan history...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-12 text-center text-sm text-slate-400">
          No scans found. Scans you execute while signed in will appear here automatically.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Job / Company / Target</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Score</th>
                <th className="py-3.5 px-4">Classification</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {items.map((item) => {
                const riskColor =
                  item.riskClassification === 'High Risk'
                    ? 'text-red-400'
                    : item.riskClassification === 'Medium Risk'
                      ? 'text-amber-400'
                      : 'text-emerald-400';

                return (
                  <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 capitalize font-mono-data text-xs text-slate-300">
                      {item.scanType}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white max-w-xs truncate">{item.jobOrCompanyName}</div>
                      <div className="text-xs text-slate-400 max-w-md truncate">{item.analysisSummary}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-data text-xs text-slate-400 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-data font-semibold text-white">
                      {item.riskScore}
                    </td>
                    <td className={`py-3.5 px-4 font-medium text-xs whitespace-nowrap ${riskColor}`}>
                      {item.riskClassification}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenReport(item.scanId)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                          title="View full report"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOne(item.scanId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Report Modal */}
      {(selectedReport || loadingReport) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
            {loadingReport ? (
              <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading full report...
              </div>
            ) : (
              selectedReport && (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {selectedReport.subjectTitle}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono-data mt-1">
                        Scan ID: {selectedReport.scanId} · {selectedReport.scanType?.toUpperCase()} ·{' '}
                        {new Date(selectedReport.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(selectedReport)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedReport(null)}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <RiskScoreGauge
                    score={selectedReport.result.riskScore}
                    classification={selectedReport.result.riskClassification}
                    confidenceLevel={selectedReport.result.confidenceLevel}
                    analysisSource={selectedReport.result.analysisSource}
                  />

                  <div className="space-y-4 text-sm text-slate-300">
                    <div>
                      <h4 className="font-semibold text-white mb-1">Summary Assessment</h4>
                      <p className="leading-relaxed">
                        {selectedReport.result.finalAssessment ||
                          selectedReport.result.explanation ||
                          selectedReport.result.overallAssessment}
                      </p>
                    </div>

                    {Array.isArray(selectedReport.result.detectedWarningSigns) &&
                      selectedReport.result.detectedWarningSigns.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-white mb-1.5">Detected Warning Signs</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {selectedReport.result.detectedWarningSigns.map((w: any, i: number) => (
                              <li key={i}>
                                <strong className="text-white">{w.category}:</strong> {w.explanation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {Array.isArray(selectedReport.result.warningSigns) &&
                      selectedReport.result.warningSigns.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-white mb-1.5">Detected Warning Signs</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {selectedReport.result.warningSigns.map((w: any, i: number) => (
                              <li key={i}>
                                <strong className="text-white">{w.indicator}:</strong> {w.explanation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    <p className="text-xs text-slate-400 border-t border-slate-800 pt-3">
                      {selectedReport.result.disclaimer}
                    </p>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
