import { useState } from 'react';
import { Globe, AlertCircle, Download, Loader2, ShieldAlert, Lock, Unlock } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { generateAndDownloadScanPdf } from '../../lib/pdfReport';
import type { UrlScanResult, ScanRecordResponse } from '../../types';
import { RiskScoreGauge } from '../RiskScoreGauge';

interface UrlScannerProps {
  isAuthenticated: boolean;
  onScanComplete?: () => void;
}

export function UrlScanner({ isAuthenticated, onScanComplete }: UrlScannerProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanRecord, setScanRecord] = useState<ScanRecordResponse<UrlScanResult> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (url.trim().length < 4) {
      setError('Please enter a valid job application URL.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<ScanRecordResponse<UrlScanResult>>('/api/scans/url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setScanRecord(res);
      onScanComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to inspect URL.');
    } finally {
      setLoading(false);
    }
  };

  const result = scanRecord?.result;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Job Application URL Checker</h2>
          <p className="text-sm text-slate-400 mt-1">
            Safely inspect URL structure, lookalike brand patterns, HTTPS availability, redirects, and configured threat-intelligence feeds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setUrl('http://google-careers-onboarding.xyz/verify-kyc?token=8819')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            Load Suspicious URL
          </button>
          <button
            type="button"
            onClick={() => setUrl('https://careers.google.com')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            Load Official Portal
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Job Application URL <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://careers.example.com/apply/12345"
              className="flex-1 rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono-data"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {loading ? 'Inspecting URL...' : 'Check URL'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Server-side validation blocks private networks, localhost, and internal IPs. No submitted page scripts are ever executed.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {result && scanRecord && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white font-mono-data break-all">{result.submittedUrl}</h3>
              <p className="text-xs text-slate-400 font-mono-data mt-0.5">
                Scan ID: {scanRecord.scanId} · {new Date(scanRecord.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                generateAndDownloadScanPdf({
                  scanId: scanRecord.scanId,
                  scanType: 'url',
                  createdAt: scanRecord.createdAt,
                  subjectTitle: result.networkEvidence.hostname || result.submittedUrl,
                  result,
                  isAuthenticated,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>

          <RiskScoreGauge
            score={result.riskScore}
            classification={result.riskClassification}
            confidenceLevel={result.confidenceLevel}
            analysisSource={result.analysisSource}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
              <h4 className="text-sm font-semibold text-white">Observed Technical Telemetry</h4>
              <dl className="divide-y divide-slate-800/80 text-sm">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">Hostname</dt>
                  <dd className="text-white font-mono-data">{result.networkEvidence.hostname || 'Unparsed'}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">HTTPS Encryption</dt>
                  <dd className="flex items-center gap-1.5 text-slate-200">
                    {result.networkEvidence.usesHttps ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>HTTPS Present (Not proof of safety)</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-amber-400" />
                        <span>No HTTPS (Unencrypted HTTP)</span>
                      </>
                    )}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">DNS Public Resolution</dt>
                  <dd className="text-slate-200 font-mono-data">
                    {result.networkEvidence.isSafeToFetch
                      ? result.networkEvidence.resolvedIps.slice(0, 2).join(', ')
                      : result.networkEvidence.blockReason || 'Unresolved'}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">HTTP Response Status</dt>
                  <dd className="text-slate-200 font-mono-data">
                    {result.networkEvidence.httpStatus ?? 'Not reachable / skipped'}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">Redirect Hops</dt>
                  <dd className="text-slate-200 font-mono-data">
                    {Math.max(0, result.networkEvidence.redirectChain.length - 1)}
                  </dd>
                </div>
              </dl>

              <div className="pt-2 border-t border-slate-800">
                <h5 className="text-xs font-semibold text-slate-300 mb-2.5">Threat Intelligence Sources</h5>
                <div className="space-y-2">
                  {result.networkEvidence.threatIntelChecks.map((ti, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-slate-300 font-medium">{ti.source}</span>
                      <span
                        className={
                          ti.status === 'flagged'
                            ? 'text-red-400 font-semibold'
                            : ti.status === 'clean'
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                        }
                      >
                        {ti.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Assessment Explanation</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{result.explanation}</p>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-white mb-2.5">Detected Indicators</h4>
                {result.detectedIndicators.length === 0 ? (
                  <p className="text-sm text-slate-400">No high-risk URL indicators detected.</p>
                ) : (
                  <div className="space-y-3">
                    {result.detectedIndicators.map((ind, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-sm">
                        <ShieldAlert
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            ind.severity === 'high' ? 'text-red-400' : ind.severity === 'medium' ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <span className="font-medium text-white">{ind.indicator}</span>
                          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">{ind.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-white mb-2">Recommended Precautions</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                  {result.recommendedPrecautions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
