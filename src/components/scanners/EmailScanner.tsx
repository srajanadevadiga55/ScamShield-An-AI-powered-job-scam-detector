import { useState } from 'react';
import { Mail, AlertCircle, Download, Loader2, MessageSquare, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { generateAndDownloadScanPdf } from '../../lib/pdfReport';
import type { EmailScanResult, ScanRecordResponse } from '../../types';
import { RiskScoreGauge } from '../RiskScoreGauge';

interface EmailScannerProps {
  isAuthenticated: boolean;
  onScanComplete?: () => void;
  onAskAssistant?: (context: string) => void;
}

const PHISHING_EMAIL_SAMPLE = {
  senderEmail: 'talent-acquisition@microsoft-careers-desk.xyz',
  subject: 'CONGRATULATIONS! Official Offer Letter & Immediate Verification Required',
  emailBody: `Dear Candidate,

Congratulations! Following review of your resume, our executive board has approved your immediate selection for the Remote Cloud Analyst position ($52/hr). No live interview is required.

To release your attached Offer_Letter_2026.docm and lock your onboarding slot within 12 hours, please:
1. Click the secure verification link: http://microsoft-onboarding-verify.xyz/kyc
2. Submit a photo of your passport/driver's license and bank routing number.
3. Send a refundable $185 security deposit via wire transfer for company workstation shipping.

Reply promptly to our Telegram HR desk (@MS_OnboardingDesk) once completed.`,
};

export function EmailScanner({ isAuthenticated, onScanComplete, onAskAssistant }: EmailScannerProps) {
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanRecord, setScanRecord] = useState<ScanRecordResponse<EmailScanResult> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (emailBody.trim().length < 25) {
      setError('Please paste at least 25 characters of the recruitment email content.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<ScanRecordResponse<EmailScanResult>>('/api/scans/email', {
        method: 'POST',
        body: JSON.stringify({ senderEmail, subject, emailBody }),
      });
      setScanRecord(res);
      onScanComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze email.');
    } finally {
      setLoading(false);
    }
  };

  const result = scanRecord?.result;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Recruitment Email Scanner</h2>
          <p className="text-sm text-slate-400 mt-1">
            Detect fake interview invitations, impersonation attempts, malicious attachment lures, payment requests, and phishing language.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSenderEmail(PHISHING_EMAIL_SAMPLE.senderEmail);
            setSubject(PHISHING_EMAIL_SAMPLE.subject);
            setEmailBody(PHISHING_EMAIL_SAMPLE.emailBody);
            setError(null);
          }}
          className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap self-start"
        >
          Load Phishing Email Example
        </button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Sender Email Address</label>
            <input
              type="text"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="e.g. hr@company-careers.com"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Interview Invitation — Software Engineer"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Recruitment Email Body <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={8}
            required
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Paste the full text of the recruiter email, including any links, requested attachments, or instructions..."
            className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none leading-relaxed"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {loading ? 'Scanning Email...' : 'Scan Recruitment Email'}
          </button>
        </div>
      </form>

      {result && scanRecord && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{result.subjectOrSender}</h3>
              <p className="text-xs text-slate-400 font-mono-data">
                Scan ID: {scanRecord.scanId} · {new Date(scanRecord.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {onAskAssistant && (
                <button
                  type="button"
                  onClick={() =>
                    onAskAssistant(
                      `Email Scan (${result.subjectOrSender}): Risk Score ${result.riskScore}/100 (${result.riskClassification}). ${result.explanation}`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask Assistant
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  generateAndDownloadScanPdf({
                    scanId: scanRecord.scanId,
                    scanType: 'email',
                    createdAt: scanRecord.createdAt,
                    subjectTitle: result.subjectOrSender,
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
          </div>

          <RiskScoreGauge
            score={result.riskScore}
            classification={result.riskClassification}
            confidenceLevel={result.confidenceLevel}
            analysisSource={result.analysisSource}
          />

          <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Analysis Explanation</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{result.explanation}</p>
            </div>

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white mb-3">Detected Warning Signs</h4>
              {result.warningSigns.length === 0 ? (
                <p className="text-sm text-slate-400">No suspicious indicators found in this email.</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {result.warningSigns.map((w, idx) => (
                    <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          w.severity === 'high' ? 'text-red-400' : w.severity === 'medium' ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {w.indicator} <span className="text-xs text-slate-400 font-normal">· {w.severity}</span>
                        </p>
                        <p className="text-sm text-slate-300 mt-1">{w.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result.suspiciousPhrases.length > 0 && (
              <div className="border-t border-slate-800 pt-5">
                <h4 className="text-sm font-semibold text-white mb-2">Suspicious Phrases</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-amber-300/90">
                  {result.suspiciousPhrases.map((p, idx) => (
                    <li key={idx}>“{p}”</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white mb-2">Recommended Next Steps</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-300">
                {result.recommendedNextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>

            <p className="border-t border-slate-800 pt-4 text-xs text-slate-400">{result.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
