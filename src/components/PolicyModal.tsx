import { X, Shield } from 'lucide-react';

interface PolicyModalProps {
  activeDoc: 'privacy' | 'disclaimer' | 'terms' | null;
  onClose: () => void;
}

export function PolicyModal({ activeDoc, onClose }: PolicyModalProps) {
  if (!activeDoc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              {activeDoc === 'privacy' && 'ScamShield Privacy Policy'}
              {activeDoc === 'disclaimer' && 'Assessment Disclaimer'}
              {activeDoc === 'terms' && 'Terms of Service'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeDoc === 'disclaimer' && (
          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p className="font-medium text-white">
              ScamShield provides AI-assisted risk assessments based on submitted information and available evidence. Results are informational and cannot guarantee that a job, company or website is legitimate or fraudulent. Users should independently verify employers through official channels.
            </p>
            <p>
              Risk scores (0–100) reflect patterns detected within the text, email, URL structure, DNS/RDAP telemetry, and configured threat intelligence sources at the moment of inspection. A Low Risk score does not guarantee an employer is genuine, and a single warning indicator does not automatically establish fraudulent intent.
            </p>
            <p>
              Always verify job openings directly on the company official website, avoid sharing sensitive government IDs or bank routing numbers before formal verified onboarding, and never pay upfront registration or equipment fees.
            </p>
          </div>
        )}

        {activeDoc === 'privacy' && (
          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">1. Data We Collect</h3>
              <p>
                When you register, we collect your name, email address, and a securely hashed password (bcrypt). When you submit job postings, emails, URLs, or company details for scanning while signed in, those inputs and resulting risk assessments are stored in your private scan history.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">2. Why Information Is Processed</h3>
              <p>
                Submitted text and URLs are processed solely to generate risk scores, highlight suspicious indicators, perform server-side DNS/redirect/threat-intelligence checks, and populate your personal analytics and PDF reports.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">3. Storage & User Isolation</h3>
              <p>
                Personal scan records are isolated per user account via server-side ownership verification. Passwords are never stored in plain text, and private network/localhost addresses are blocked during URL inspection.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">4. Deleting Your Data</h3>
              <p>
                You can delete individual scan records or clear your entire scan history at any time from the Scan History tab, or permanently delete your account and all associated data from Profile & Settings.
              </p>
            </div>
          </div>
        )}

        {activeDoc === 'terms' && (
          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p>
              ScamShield is designed to assist job seekers in evaluating potential recruitment fraud. Users agree not to submit unlawful content, attempt unauthorized system access, or use URL scanning tools to probe private/internal networks.
            </p>
            <p>
              Community scam reports submitted to the public directory should reflect factual observations without including personal financial credentials or sensitive third-party identity documents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
