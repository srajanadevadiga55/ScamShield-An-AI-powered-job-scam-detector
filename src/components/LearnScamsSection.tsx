import { useState } from 'react';
import { BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ScamTopic {
  id: string;
  title: string;
  summary: string;
  example: string;
  warningSigns: string[];
  protectionTip: string;
}

const EDUCATIONAL_TOPICS: ScamTopic[] = [
  {
    id: 'fake-offers',
    title: 'Fake Job Offers',
    summary:
      'Fraudsters send unsolicited job offers with high pay and immediate start dates—often skipping interviews entirely—to harvest personal data or extract money.',
    example:
      'Receiving an emailed "Official Employment Agreement" for a $50/hr position you never applied to, asking for immediate signature and tax forms.',
    warningSigns: [
      'Offer arrives without a live technical or HR interview.',
      'Job responsibilities are generic or copied from unrelated postings.',
      'High-pressure deadlines requiring acceptance within 12–24 hours.',
    ],
    protectionTip: 'Verify every unsolicited offer on the employer official careers portal before sharing documents.',
  },
  {
    id: 'recruitment-fees',
    title: 'Recruitment Fee Fraud',
    summary:
      'Scammers demand upfront payments labeled as registration fees, training bonds, background-check charges, visa processing, or refundable security deposits.',
    example:
      'A recruiter instructs you to pay $195 via instant transfer or gift card to unlock onboarding credentials or receive a company laptop.',
    warningSigns: [
      'Requests for registration, application, or kit fees.',
      'Fake check scams asking you to deposit a check and wire funds to an equipment vendor.',
      'Payment requested via cryptocurrency, wire transfer, or gift cards.',
    ],
    protectionTip: 'Legitimate employers cover their own hiring, background check, and equipment expenses.',
  },
  {
    id: 'wfh-scams',
    title: 'Work-From-Home & Task Scams',
    summary:
      'Fake remote jobs advertise effortless daily tasks—such as rating apps, processing orders, or basic data entry—for disproportionately high weekly payouts.',
    example:
      'An ad promises $1,500/week for 1 hour of daily data entry, then asks you to deposit funds to unlock higher-tier "task batches".',
    warningSigns: [
      'Guaranteed high income with zero required experience.',
      'Vague descriptions such as "product optimization" or "order brushing".',
      'Requirement to top up an account balance to withdraw earned commissions.',
    ],
    protectionTip: 'Real remote roles clearly define technical tools, team structure, and standard payroll cycles.',
  },
  {
    id: 'fake-recruiters',
    title: 'Fake Recruiters',
    summary:
      'Impostors pose as HR managers on social networks or messaging apps, conducting interviews strictly over text chat to avoid voice or video verification.',
    example:
      'A recruiter moves the conversation immediately to Telegram or WhatsApp and conducts a 15-minute text-only questionnaire before extending an offer.',
    warningSigns: [
      'Recruiter refuses live video calls or corporate calendar invites.',
      'Profile lacks verifiable work history or connects from a brand-new account.',
      'Contact email uses a free webmail address while claiming to represent a major firm.',
    ],
    protectionTip: 'Ask for an official corporate calendar invitation and verify the recruiter on the company website.',
  },
  {
    id: 'phishing-emails',
    title: 'Phishing Recruitment Emails',
    summary:
      'Attackers craft urgent hiring emails with lookalike links or macro-enabled attachments designed to steal login credentials or install malware.',
    example:
      'An email with subject "Interview Confirmed — Download Case_Brief.docm" linking to a fake Microsoft or Workday sign-in page.',
    warningSigns: [
      'Sender display name says a known company, but the email domain does not match.',
      'Links redirect to unfamiliar domains asking you to log in with your primary email password.',
      'Unexpected executable, ZIP, or macro-enabled attachments.',
    ],
    protectionTip: 'Inspect the full sender address and scan suspicious links with ScamShield URL Checker before clicking.',
  },
  {
    id: 'company-impersonation',
    title: 'Impersonation of Real Companies',
    summary:
      'Scammers register lookalike domains (e.g., adding "-careers" or ".xyz") and copy branding from Fortune 500 firms to appear trustworthy.',
    example:
      'Messages coming from hr@deloitte-talent-desk.xyz instead of the legitimate corporate domain.',
    warningSigns: [
      'Lookalike domain suffixes such as -careers-portal.xyz or misspelled brand letters.',
      'Domain registered very recently with no link back from the real corporate homepage.',
      'Inconsistent physical office addresses or fake registration numbers.',
    ],
    protectionTip: 'Use ScamShield Company Verification to compare email domains against the official corporate domain.',
  },
  {
    id: 'fake-interviews',
    title: 'Fake Interview Processes',
    summary:
      'Fraudulent hiring flows replace authentic human conversations with automated questionnaires, messaging apps, or pre-recorded prompts.',
    example:
      'You are asked to complete a 10-question Google Form and immediately receive a formal salary contract.',
    warningSigns: [
      'Zero live voice or video interaction with a hiring manager.',
      'Instant selection regardless of qualification match.',
      'Interviewers ask for banking or SSN details during the initial screening.',
    ],
    protectionTip: 'Expect multi-step human conversations before any formal employment contract is issued.',
  },
  {
    id: 'safe-practices',
    title: 'Safe Job Application Practices',
    summary:
      'Consistent verification habits protect your identity, bank accounts, and personal data throughout an active job search.',
    example:
      'Always navigating manually to the company official website careers page instead of clicking links inside unsolicited messages.',
    warningSigns: [
      'Sharing government IDs, SSN, or bank routing numbers before verifying the employer.',
      'Reusing your primary email password on unfamiliar job portals.',
      'Ignoring small mismatches between recruiter email domains and official websites.',
    ],
    protectionTip: 'Check the sender domain, ask one proof question, expect a real interview, inspect links, and guard sensitive IDs.',
  },
];

const BEFORE_YOU_APPLY_CHECKLIST = [
  {
    title: 'Check the sender domain',
    detail: 'Confirm the recruiter email matches the official corporate domain—not a free webmail inbox or lookalike suffix.',
  },
  {
    title: 'Ask one proof question',
    detail: 'Request a calendar invite from their corporate email and ask for the public job requisition ID on their official site.',
  },
  {
    title: 'Expect a real interview',
    detail: 'Legitimate employers conduct live voice or video interviews before issuing formal offers.',
  },
  {
    title: 'Inspect the link',
    detail: 'Never assume HTTPS means safe. Check the exact root domain before entering credentials or uploading documents.',
  },
  {
    title: 'Keep your information private',
    detail: 'Wait until formal verified onboarding before providing SSN, passport scans, or bank routing details.',
  },
];

export function LearnScamsSection() {
  const [selectedId, setSelectedId] = useState<string>(EDUCATIONAL_TOPICS[0].id);
  const activeTopic = EDUCATIONAL_TOPICS.find((t) => t.id === selectedId) || EDUCATIONAL_TOPICS[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Learn About Job Scams</h2>
          <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
            Practical guides, real-world fraud patterns, and defensive checklists to help job seekers recognize manipulation tactics early.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-1.5">
          {EDUCATIONAL_TOPICS.map((topic, index) => {
            const isActive = topic.id === activeTopic.id;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => setSelectedId(topic.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors flex items-center gap-3 ${
                  isActive
                    ? 'bg-blue-600/15 border-blue-500/40 text-white font-semibold'
                    : 'bg-[#0D1528] border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className="font-mono-data text-xs text-slate-500">0{index + 1}.</span>
                <span className="truncate">{topic.title}</span>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xl font-semibold text-white">{activeTopic.title}</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">{activeTopic.summary}</p>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h4 className="text-xs font-semibold text-slate-400 mb-1.5">Practical Example</h4>
            <p className="text-sm text-slate-200 leading-relaxed">{activeTopic.example}</p>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h4 className="text-xs font-semibold text-slate-400 mb-2.5">Key Warning Signs</h4>
            <ul className="space-y-2">
              {activeTopic.warningSigns.map((sign, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{sign}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-slate-800 pt-4 flex items-start gap-2.5 text-sm text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-emerald-200 font-semibold">Protective Habit:</strong> {activeTopic.protectionTip}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6">
        <h3 className="text-base font-semibold text-white mb-4">Before You Apply — 5-Point Verification Checklist</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {BEFORE_YOU_APPLY_CHECKLIST.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <p className="text-xs font-mono-data text-blue-400">0{idx + 1}</p>
              <h4 className="text-sm font-semibold text-white">{item.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
