import { useState } from 'react';
import {
  ShieldCheck,
  FileSearch,
  Mail,
  Globe,
  Building2,
  MessageSquare,
  FileDown,
  ArrowRight,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  LayoutDashboard,
} from 'lucide-react';
import type { User } from '../types';
import { apiRequest } from '../lib/api';
import { JobScamDetector } from './scanners/JobScamDetector';
import { EmailScanner } from './scanners/EmailScanner';
import { UrlScanner } from './scanners/UrlScanner';
import { CompanyVerifier } from './scanners/CompanyVerifier';
import { LearnScamsSection } from './LearnScamsSection';
import { CommunityReportsView } from './CommunityReportsView';

interface LandingPageProps {
  user: User | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterDashboard: (initialTab?: string) => void;
  onSignOut: () => void;
  onOpenAssistant: (context?: string) => void;
  onOpenPolicy: (doc: 'privacy' | 'disclaimer' | 'terms') => void;
}

const DEMONSTRATION_STATS = [
  { label: 'Jobs Analysed', value: '12,480+', note: 'Illustrative benchmark' },
  { label: 'Potential Scams Identified', value: '2,140+', note: 'Illustrative benchmark' },
  { label: 'Detection Categories', value: '12', note: 'Core fraud vectors' },
  { label: 'Users Protected', value: '8,900+', note: 'Illustrative benchmark' },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Submit a job listing, email or URL',
    description:
      'Paste a job advertisement, suspicious recruitment email, application link, or company contact details into the dedicated scanner.',
  },
  {
    step: '02',
    title: 'AI analyses the submitted information',
    description:
      'ScamShield evaluates 12 fraud patterns alongside safe server-side DNS, redirect tracing, and domain alignment checks.',
  },
  {
    step: '03',
    title: 'ScamShield identifies suspicious indicators',
    description:
      'Detected warning signs, flagged phrases, and positive indicators are separated clearly so single minor flags are never over-penalized.',
  },
  {
    step: '04',
    title: 'Receive a risk score and safety recommendations',
    description:
      'Review an interpretable 0–100 risk gauge, concrete verification steps, and export a structured PDF report for your records.',
  },
];

const SEVEN_DETECTION_LAYERS = [
  'Salary realism & too-good-to-be-true pay claims',
  'Upfront registration, training, or equipment fee demands',
  'Channel anomalies (WhatsApp/Telegram text-only interviews)',
  'Premature SSN, passport, or banking credential requests',
  'Domain alignment & free webmail impersonation checks',
  'Safe URL redirect tracing & threat-feed reputation lookups',
  'Offer urgency pressure & missing corporate accountability',
];

export function LandingPage({
  user,
  onOpenAuth,
  onEnterDashboard,
  onSignOut,
  onOpenAssistant,
  onOpenPolicy,
}: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [aboutImgFailed, setAboutImgFailed] = useState(false);
  const [activeQuickTool, setActiveQuickTool] = useState<'job' | 'email' | 'url' | 'company'>('job');
  const [resourceTab, setResourceTab] = useState<'learn' | 'reports'>('learn');

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactFeedback(null);
    setContactLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage,
          websiteField: honeypot,
        }),
      });
      setContactFeedback({ type: 'success', text: res.message });
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    } catch (err) {
      setContactFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send message.',
      });
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070C18]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a href="#home" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            <span>ScamShield</span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#home" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#features" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#about" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              About Us
            </a>
            <a href="#contact" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => onEnterDashboard('overview')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="hidden sm:inline-flex rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 px-2 py-1.5"
                >
                  Login / Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
                >
                  Get Started
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-[#0B1222] px-4 py-4 space-y-3">
            <div className="flex flex-col space-y-2.5 text-sm font-medium text-slate-200">
              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Home</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-1.5">How It Works</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="py-1.5">About Us</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Contact</a>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onEnterDashboard('overview');
                  }}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Open Dashboard
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('login');
                    }}
                    className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('register');
                    }}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="home" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-14 lg:pt-16 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <p className="text-xs font-medium text-blue-400 tracking-wide">
              Recruitment Threat Intelligence · Job Seeker Protection
            </p>
            <h1
              className="font-display font-bold text-white tracking-tight leading-[1.12] [text-wrap:balance]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)' }}
            >
              Stay Safe. Spot Job Scams Before They Spot You.
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              An AI-powered platform that helps you identify fraudulent job offers, suspicious recruiters and fake employment opportunities.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <a
                href="#scanner"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
              >
                Start Scanning
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1528] px-6 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:text-white transition-colors whitespace-nowrap"
              >
                Explore Features
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[280px] rounded-xl border border-slate-800 bg-[#0D1528] overflow-hidden">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_cyber_shield_1794721249566.jpg"
                  alt="ScamShield dark obsidian geometric cybersecurity shield visualization"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#0B1222] to-[#111C33]">
                  <ShieldCheck className="w-16 h-16 text-blue-500 mb-3" />
                  <p className="text-sm font-medium text-slate-200">ScamShield Verification Engine</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Demonstration Statistics Strip */}
        <div className="mt-12 rounded-xl border border-slate-800 bg-[#0D1528] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">Platform Coverage Overview</h2>
            <span className="text-xs text-slate-400">
              Demonstration Metrics (Illustrative Benchmarks)
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {DEMONSTRATION_STATS.map((stat) => (
              <div key={stat.label} className="space-y-1">
                <div className="font-mono-data text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm font-medium text-slate-300">{stat.label}</div>
                <div className="text-xs text-slate-500">{stat.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Quick Scanner Workbench */}
      <section id="scanner" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-800/80">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Run an Immediate Security Scan
            </h2>
            <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
              Test a job ad, recruitment email, application URL, or company contact immediately. Sign in anytime to persist scan history and track analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0D1528] border border-slate-800 self-start">
            {(
              [
                { id: 'job', label: 'Job Posting', Icon: FileSearch },
                { id: 'email', label: 'Email Scanner', Icon: Mail },
                { id: 'url', label: 'URL Checker', Icon: Globe },
                { id: 'company', label: 'Company Check', Icon: Building2 },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveQuickTool(id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeQuickTool === id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {!user && (
          <div className="mb-6 rounded-xl border border-blue-500/25 bg-[#0D1528] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">Save your scan history & PDF archive:</span>{' '}
              Create a free account or sign in to unlock your personal security dashboard, notifications, and analytics.
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2 text-xs font-medium text-white hover:border-slate-600 whitespace-nowrap"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {activeQuickTool === 'job' && (
          <JobScamDetector
            isAuthenticated={Boolean(user)}
            onAskAssistant={(ctx) => onOpenAssistant(ctx)}
          />
        )}
        {activeQuickTool === 'email' && (
          <EmailScanner
            isAuthenticated={Boolean(user)}
            onAskAssistant={(ctx) => onOpenAssistant(ctx)}
          />
        )}
        {activeQuickTool === 'url' && <UrlScanner isAuthenticated={Boolean(user)} />}
        {activeQuickTool === 'company' && <CompanyVerifier isAuthenticated={Boolean(user)} />}
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-800/80">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How ScamShield Works</h2>
          <p className="text-sm text-slate-400 mt-2">
            Four structured verification steps designed to turn ambiguous recruiter outreach into clear, actionable risk intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <div key={item.step} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-3">
              <div className="font-mono-data text-sm font-semibold text-blue-400">Step {item.step}</div>
              <h3 className="text-base font-semibold text-white leading-snug">{item.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Asymmetric Bento Grid + 7 Detection Layers */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-800/80">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Comprehensive Recruitment Threat Detection
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Built to examine job descriptions, email headers, application portals, and corporate domain records in one unified workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0D1528] p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-blue-400">
                <FileSearch className="w-5 h-5" />
                <span className="text-xs font-semibold">Primary Engine</span>
              </div>
              <h3 className="text-xl font-semibold text-white">AI Job Scam Detector & 7-Layer Inspection</h3>
              <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                Evaluates complete job descriptions across 12 recruitment fraud categories while balancing positive signals so legitimate remote roles are not misclassified on a single minor quirk.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800">
              {SEVEN_DETECTION_LAYERS.map((layer, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>{layer}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
            <Mail className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Recruitment Email Scanner</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Detects fake interview invitations, macro-enabled offer letter lures, executive impersonation, and upfront fee demands hidden in recruiter emails.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
            <Globe className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Safe URL & Redirect Checker</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Inspects domain structure, lookalike brand typosquatting, HTTPS status, redirect chains, and threat-intelligence feeds while blocking private network probing.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Evidence-Based Company Verification</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Cross-checks public DNS, MX mail records, RDAP domain registration, and recruiter email alignment without ever fabricating unverified corporate filings.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <FileDown className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">ScamShield Assistant & PDF Reports</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ask follow-up questions about suspicious messages, manage private scan history with real-time analytics, and download structured PDF evidence reports.
            </p>
          </div>
        </div>
      </section>

      {/* About Us */}
      <section id="about" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="aspect-[4/3] rounded-xl border border-slate-800 bg-[#0D1528] overflow-hidden">
              {!aboutImgFailed ? (
                <img
                  src="/src/assets/images/about_verification_lab_1794721250375.jpg"
                  alt="Cybersecurity analyst inspecting network threat graphs in dark navy studio"
                  referrerPolicy="no-referrer"
                  onError={() => setAboutImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8 text-slate-400 text-sm">
                  ScamShield Verification Intelligence
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Built to Protect Job Seekers From Modern Recruitment Fraud
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Job seekers—especially graduates, remote applicants, and career switchers—frequently face convincing impersonation campaigns, fake check equipment scams, and identity-harvesting portals. ScamShield brings structured cybersecurity inspection directly to candidates before they share personal records or money.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Rather than issuing opaque yes/no verdicts, ScamShield explains every risk factor transparently, separates verified technical observations from unverified claims, and encourages independent confirmation through official employer channels.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenAssistant()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1528] px-4 py-2.5 text-xs font-semibold text-white hover:border-blue-500/60 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-blue-400" />
                Ask ScamShield Assistant
              </button>
              <button
                type="button"
                onClick={() => (user ? onEnterDashboard('overview') : onOpenAuth('register'))}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                {user ? 'Go to Personal Dashboard' : 'Create Free Account'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Educational Resources & Community Scam Reports */}
      <section id="resources" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-800/80">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D1528] border border-slate-800 w-fit mb-8">
          <button
            type="button"
            onClick={() => setResourceTab('learn')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              resourceTab === 'learn' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            Learn About Job Scams
          </button>
          <button
            type="button"
            onClick={() => setResourceTab('reports')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              resourceTab === 'reports' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            Community Scam Reports
          </button>
        </div>

        {resourceTab === 'learn' ? <LearnScamsSection /> : <CommunityReportsView />}
      </section>

      {/* Contact & Feedback */}
      <section id="contact" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Contact & Feedback</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Have questions about an analysis report, want to suggest detection improvements, or need to reach our safety moderation team? Send us a message below.
            </p>
            <div className="pt-2 space-y-2 text-sm text-slate-400">
              <div>Security Desk: <span className="text-slate-200 font-mono-data">security@scamshield.sec</span></div>
              <div>Community Moderation: <span className="text-slate-200">Reviewed daily</span></div>
            </div>
          </div>

          <form
            onSubmit={handleContactSubmit}
            className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4"
          >
            {/* Anti-spam honeypot */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Name *</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Subject *</label>
              <input
                type="text"
                required
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
                placeholder="Platform feedback or inquiry"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Message *</label>
              <textarea
                rows={4}
                required
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Share details of your question or feedback..."
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {contactFeedback && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  contactFeedback.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}
              >
                {contactFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{contactFeedback.text}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={contactLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {contactLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Message
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800 bg-[#050912]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-2.5 text-base font-bold text-white">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <span>ScamShield</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <a href="#home" className="hover:text-white">Home</a>
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#how-it-works" className="hover:text-white">How It Works</a>
              <a href="#about" className="hover:text-white">About Us</a>
              <a href="#contact" className="hover:text-white">Contact</a>
              <button type="button" onClick={() => onOpenPolicy('privacy')} className="hover:text-white">
                Privacy Policy
              </button>
              <button type="button" onClick={() => onOpenPolicy('terms')} className="hover:text-white">
                Terms
              </button>
              <button type="button" onClick={() => onOpenPolicy('disclaimer')} className="hover:text-white">
                Disclaimer
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-900 pt-6">
            ScamShield provides AI-assisted risk assessments based on submitted information and available evidence. Results are informational and cannot guarantee that a job, company or website is legitimate or fraudulent. Users should independently verify employers through official channels.
          </p>
        </div>
      </footer>

      {/* Floating Assistant Trigger */}
      <button
        type="button"
        onClick={() => onOpenAssistant()}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold text-white shadow-lg hover:bg-blue-500 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        ScamShield Assistant
      </button>
    </div>
  );
}
