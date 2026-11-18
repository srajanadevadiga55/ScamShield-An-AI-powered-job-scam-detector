import { useState } from 'react';
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { generateAndDownloadScanPdf } from '../../lib/pdfReport';
import type { JobScanResult, ScanRecordResponse } from '../../types';
import { RiskScoreGauge } from '../RiskScoreGauge';

interface JobScamDetectorProps {
  isAuthenticated: boolean;
  onScanComplete?: () => void;
  onAskAssistant?: (context: string) => void;
}

const SCAM_SAMPLE = {
  jobTitle: 'Remote Data Entry Specialist — Immediate Start',
  companyName: 'Global Apex Logistics Solutions',
  recruiterInfo: 'Marcus Vance (hr.apexdesk@gmail.com) — Telegram @ApexHR_Onboarding',
  salaryDetails: '$45 - $65 per hour (Guaranteed weekly payout, no experience needed)',
  jobLocation: 'Work From Home (Remote)',
  applicationUrl: 'https://apex-onboarding-portal.xyz/verify-kyc',
  jobDescription: `URGENT HIRING TODAY! Limited slots remaining. You have been pre-selected for our remote data entry team. No prior experience required and flexible 1-2 hours daily schedule with guaranteed $1,800/week income.

Interview Process: Text-only screening conducted exclusively via Telegram. No video call needed.

To finalize your onboarding and receive your company laptop, you must pay a refundable $150 registration and software license fee or deposit an advance mobile check to purchase equipment from our certified vendor. Please also reply with a clear photo of your government ID, Social Security Number, and bank routing details for immediate direct deposit setup.`,
};

const LEGIT_SAMPLE = {
  jobTitle: 'Frontend Software Engineer (React & TypeScript)',
  companyName: 'Northstar Cloud Systems Inc.',
  recruiterInfo: 'Priya Nair, Technical Recruiter (priya.nair@northstarcloud.io)',
  salaryDetails: '$115,000 - $135,000 base salary + health benefits & 401(k)',
  jobLocation: 'Seattle, WA (Hybrid — 3 days onsite)',
  applicationUrl: 'https://careers.northstarcloud.io/jobs/frontend-engineer',
  jobDescription: `About the Role:
Northstar Cloud Systems is seeking a Frontend Software Engineer to help build our observability dashboard and customer reporting interfaces.

Responsibilities:
- Build accessible, modular UI components in React, TypeScript, and Tailwind CSS.
- Collaborate with backend engineers on REST API schemas and performance optimization.
- Write unit and integration tests and participate in peer code reviews.

Qualifications:
- 2+ years of production experience with React and modern TypeScript.
- Familiarity with web accessibility standards (WCAG AA) and RESTful APIs.

Interview Process:
1. 30-minute recruiter phone screen.
2. 45-minute technical pairing session via video call.
3. Final panel interview with engineering and product leads.

Equal Opportunity Employer. We never charge fees during recruitment.`,
};

export function JobScamDetector({
  isAuthenticated,
  onScanComplete,
  onAskAssistant,
}: JobScamDetectorProps) {
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [recruiterInfo, setRecruiterInfo] = useState('');
  const [salaryDetails, setSalaryDetails] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanRecord, setScanRecord] = useState<ScanRecordResponse<JobScanResult> | null>(null);

  const loadSample = (sample: typeof SCAM_SAMPLE) => {
    setJobTitle(sample.jobTitle);
    setCompanyName(sample.companyName);
    setRecruiterInfo(sample.recruiterInfo);
    setSalaryDetails(sample.salaryDetails);
    setJobLocation(sample.jobLocation);
    setApplicationUrl(sample.applicationUrl);
    setJobDescription(sample.jobDescription);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (
      !jobTitle.trim() ||
      !companyName.trim() ||
      !recruiterInfo.trim() ||
      !salaryDetails.trim() ||
      !jobLocation.trim()
    ) {
      setError('Please fill in all required job fields (only Application URL is optional).');
      return;
    }
    if (jobDescription.trim().length < 30) {
      setError('Please paste at least 30 characters of the job description for accurate analysis.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<ScanRecordResponse<JobScanResult>>('/api/scans/job', {
        method: 'POST',
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          recruiterInfo: recruiterInfo.trim(),
          salaryDetails: salaryDetails.trim(),
          jobLocation: jobLocation.trim(),
          applicationUrl: applicationUrl.trim(),
          jobDescription: jobDescription.trim(),
        }),
      });
      setScanRecord(res);
      onScanComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze job listing.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!scanRecord) return;
    await generateAndDownloadScanPdf({
      scanId: scanRecord.scanId,
      scanType: 'job',
      createdAt: scanRecord.createdAt,
      subjectTitle: scanRecord.result.jobTitle,
      companyName: scanRecord.result.companyName,
      result: scanRecord.result,
      isAuthenticated,
    });
  };

  const result = scanRecord?.result;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Job Scam Detector</h2>
          <p className="text-sm text-slate-400 mt-1">
            Inspect job postings across 12 fraud dimensions including upfront fee demands, unrealistic salaries, and irregular hiring channels.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadSample(SCAM_SAMPLE)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Load Scam Example
          </button>
          <button
            type="button"
            onClick={() => loadSample(LEGIT_SAMPLE)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Load Legit Ad Example
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
        <p className="text-xs text-slate-400">
          Fields marked <span className="text-red-400">*</span> are required. <span className="text-slate-200 font-medium">Application URL</span> is optional.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Job Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Remote Data Entry Specialist"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Logistics Pvt Ltd"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Recruiter Information <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={recruiterInfo}
              onChange={(e) => setRecruiterInfo(e.target.value)}
              placeholder="Name, email address, phone, or chat handle"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Salary / Compensation Details <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={salaryDetails}
              onChange={(e) => setSalaryDetails(e.target.value)}
              placeholder="e.g. $45/hr or $80,000/yr"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Job Location <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={jobLocation}
              onChange={(e) => setJobLocation(e.target.value)}
              placeholder="e.g. Remote / Austin, TX"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Application URL <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={applicationUrl}
              onChange={(e) => setApplicationUrl(e.target.value)}
              placeholder="Optional — https://company.com/careers/role"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Complete Job Description <span className="text-red-400">*</span>
            </label>
            <span className="text-xs text-slate-500 font-mono-data">{jobDescription.length} / 12,000 chars</span>
          </div>
          <textarea
            rows={7}
            required
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the complete job advertisement, responsibilities, interview instructions, and any payment or onboarding requirements..."
            className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none leading-relaxed"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <p className="text-xs text-slate-400">
            {isAuthenticated
              ? 'Results will be saved to your private Scan History.'
              : 'Sign in to save this scan to your personal history and download PDF archive reports.'}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? 'Analyzing Job Listing...' : 'Analyze Job Posting'}
          </button>
        </div>
      </form>

      {result && scanRecord && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {result.jobTitle} — <span className="text-slate-300 font-normal">{result.companyName}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono-data mt-0.5">
                Scan ID: {scanRecord.scanId} · {new Date(scanRecord.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {onAskAssistant && (
                <button
                  type="button"
                  onClick={() =>
                    onAskAssistant(
                      `Job Scan: ${result.jobTitle} at ${result.companyName}. Risk Score: ${result.riskScore}/100 (${result.riskClassification}). Assessment: ${result.finalAssessment}`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask Assistant
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
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
              <h4 className="text-sm font-semibold text-white mb-2">Final AI Assessment</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{result.finalAssessment}</p>
            </div>

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white mb-3">Detected Warning Signs</h4>
              {result.detectedWarningSigns.length === 0 ? (
                <p className="text-sm text-slate-400">No major warning signs were triggered by the submitted text.</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {result.detectedWarningSigns.map((item, idx) => (
                    <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          item.severity === 'high'
                            ? 'text-red-400'
                            : item.severity === 'medium'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                        }`}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          <span>{item.category}</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span
                            className={`text-xs capitalize ${
                              item.severity === 'high'
                                ? 'text-red-400'
                                : item.severity === 'medium'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {item.severity} severity
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{item.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result.suspiciousPhrases.length > 0 && (
              <div className="border-t border-slate-800 pt-5">
                <h4 className="text-sm font-semibold text-white mb-2.5">Suspicious Phrases Highlighted</h4>
                <ul className="space-y-1.5 text-sm text-amber-300/90 list-disc pl-5">
                  {result.suspiciousPhrases.map((phrase, idx) => (
                    <li key={idx}>“{phrase}”</li>
                  ))}
                </ul>
              </div>
            )}

            {result.positiveIndicators.length > 0 && (
              <div className="border-t border-slate-800 pt-5">
                <h4 className="text-sm font-semibold text-white mb-2.5">Positive Indicators Observed</h4>
                <ul className="space-y-2">
                  {result.positiveIndicators.map((pos, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-emerald-300/90">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                      <span>{pos}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white mb-2.5">Recommended Precautions</h4>
              <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5">
                {result.recommendedPrecautions.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-800 pt-4 text-xs text-slate-400 leading-relaxed">
              {result.disclaimer}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
