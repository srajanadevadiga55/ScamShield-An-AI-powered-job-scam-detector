import { useState } from 'react';
import {
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { generateAndDownloadScanPdf } from '../../lib/pdfReport';
import type { CompanyVerificationResult, ScanRecordResponse } from '../../types';
import { RiskScoreGauge } from '../RiskScoreGauge';

interface CompanyVerifierProps {
  isAuthenticated: boolean;
  onScanComplete?: () => void;
}

export function CompanyVerifier({ isAuthenticated, onScanComplete }: CompanyVerifierProps) {
  const [companyName, setCompanyName] = useState('');
  const [officialWebsite, setOfficialWebsite] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [location, setLocation] = useState('');
  const [registrationDetails, setRegistrationDetails] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanRecord, setScanRecord] = useState<ScanRecordResponse<CompanyVerificationResult> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (companyName.trim().length < 2) {
      setError('Please enter a company name.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<ScanRecordResponse<CompanyVerificationResult>>('/api/scans/company', {
        method: 'POST',
        body: JSON.stringify({
          companyName,
          officialWebsite,
          companyEmail,
          location,
          registrationDetails,
        }),
      });
      setScanRecord(res);
      onScanComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify company details.');
    } finally {
      setLoading(false);
    }
  };

  const result = scanRecord?.result;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Company Verification</h2>
          <p className="text-sm text-slate-400 mt-1">
            Cross-check website DNS, MX mail records, RDAP domain registration, and recruiter email domain alignment. We never fabricate registrations or badges.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCompanyName('Stripe Inc.');
            setOfficialWebsite('https://stripe.com');
            setCompanyEmail('recruiting-stripe@gmail.com');
            setLocation('South San Francisco, CA');
            setRegistrationDetails('');
            setError(null);
          }}
          className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 whitespace-nowrap self-start"
        >
          Load Mismatch Example
        </button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Stripe Inc."
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Official Website</label>
            <input
              type="text"
              value={officialWebsite}
              onChange={(e) => setOfficialWebsite(e.target.value)}
              placeholder="https://company.com"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Recruiter / Company Email</label>
            <input
              type="text"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="recruiter@company.com"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Claimed Office Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Chicago, IL"
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Registration / Tax ID Details (Optional)
          </label>
          <input
            type="text"
            value={registrationDetails}
            onChange={(e) => setRegistrationDetails(e.target.value)}
            placeholder="e.g. CIN / EIN / UK Companies House number if provided in offer"
            className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            {loading ? 'Verifying Domain & Evidence...' : 'Verify Company Details'}
          </button>
        </div>
      </form>

      {result && scanRecord && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{result.companyName}</h3>
              <p className="text-xs text-slate-400 font-mono-data">
                Scan ID: {scanRecord.scanId} · {new Date(scanRecord.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                generateAndDownloadScanPdf({
                  scanId: scanRecord.scanId,
                  scanType: 'company',
                  createdAt: scanRecord.createdAt,
                  subjectTitle: result.companyName,
                  companyName: result.companyName,
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
            analysisSource={result.analysisSource}
          />

          <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Overall Verification Assessment</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{result.overallAssessment}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-800 pt-5">
              <div>
                <h4 className="text-sm font-semibold text-white mb-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Evidence Found & Matches
                </h4>
                <ul className="space-y-2 text-sm text-slate-300">
                  {[...result.evidenceFound, ...result.informationMatches].map((item, idx) => (
                    <li key={idx} className="leading-relaxed">• {item}</li>
                  ))}
                  {result.evidenceFound.length === 0 && result.informationMatches.length === 0 && (
                    <li className="text-slate-400">No matching technical evidence observed.</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-2.5 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  Information That Does Not Match
                </h4>
                <ul className="space-y-2 text-sm text-red-300/90">
                  {result.informationDoesNotMatch.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">• {item}</li>
                  ))}
                  {result.informationDoesNotMatch.length === 0 && (
                    <li className="text-slate-400">No direct mismatches detected in submitted fields.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white mb-2.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Information That Could Not Be Verified
              </h4>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {result.couldNotVerify.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white mb-2">Recommended Verification Steps</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                {result.recommendedSteps.map((step, idx) => (
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
