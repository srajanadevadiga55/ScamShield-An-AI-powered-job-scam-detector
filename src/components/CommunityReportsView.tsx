import { useState, useEffect, useCallback } from 'react';
import { Flag, Search, ThumbsUp, Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { CommunityReport } from '../types';

export function CommunityReportsView() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [showForm, setShowForm] = useState(false);

  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [scamType, setScamType] = useState('Advance Fee / Registration Fee');
  const [platformSource, setPlatformSource] = useState('LinkedIn / Job Board');
  const [contactUsed, setContactUsed] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiRequest<{ items: CommunityReport[] }>(`/api/reports?${params.toString()}`);
      setReports(res.items);
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleUpvote = async (id: string) => {
    try {
      const res = await apiRequest<{ upvotes: number }>(`/api/reports/${id}/upvote`, { method: 'POST' });
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, upvotes: res.upvotes } : r)));
    } catch {
      // rate limit or error
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          jobTitle,
          companyName,
          scamType,
          platformSource,
          contactUsed,
          evidenceUrl,
          description,
        }),
      });
      setFormMsg({ type: 'success', text: res.message });
      setJobTitle('');
      setCompanyName('');
      setContactUsed('');
      setEvidenceUrl('');
      setDescription('');
      setShowForm(false);
      await loadReports();
    } catch (err) {
      setFormMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to submit report.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Community Scam Reports</h2>
          <p className="text-sm text-slate-400 mt-1">
            Browse community-reported suspicious listings and contribute anonymized warning signals. Community reports represent user signals, not legal determinations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close Report Form' : 'Report Suspicious Job'}
        </button>
      </div>

      {formMsg && (
        <div
          className={`flex items-start gap-2.5 rounded-lg border p-3.5 text-sm ${
            formMsg.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {formMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{formMsg.text}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmitReport} className="rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Submit a Suspicious Job Listing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Job Title *</label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Remote Data Entry Clerk"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Company / Impersonated Brand *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Global Apex Logistics"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Scam Category</label>
              <select
                value={scamType}
                onChange={(e) => setScamType(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option>Advance Fee / Registration Fee</option>
                <option>Fake Check / Equipment Purchase Scam</option>
                <option>Phishing & Identity Harvesting</option>
                <option>Company Impersonation</option>
                <option>Task / Work-From-Home Deposit Scam</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Platform / Channel</label>
              <select
                value={platformSource}
                onChange={(e) => setPlatformSource(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option>LinkedIn / Job Board</option>
                <option>Telegram / WhatsApp</option>
                <option>Unsolicited Email</option>
                <option>Social Media Ad</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Recruiter Contact / Email Used</label>
              <input
                type="text"
                value={contactUsed}
                onChange={(e) => setContactUsed(e.target.value)}
                placeholder="e.g. hr-desk@gmail.com"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Suspicious URL (Optional)</label>
              <input
                type="text"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://suspicious-portal.example"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">What Happened? *</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the warning signs observed (at least 20 characters). Do not include your personal SSN or bank account numbers."
              className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
              Submit Report
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reported companies, roles, or tactics..."
            className="w-full rounded-lg border border-slate-800 bg-[#0D1528] pl-10 pr-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D1528] border border-slate-800 self-start">
          {(['all', 'verified', 'pending'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                statusFilter === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-sm text-slate-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading community reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-10 text-center text-sm text-slate-400">
          No community scam reports matched your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <article key={report.id} className="rounded-xl border border-slate-800 bg-[#0D1528] p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">
                    <span>{report.scamType}</span>
                    <span aria-hidden="true" className="mx-1.5">·</span>
                    <span>{report.platformSource}</span>
                    <span aria-hidden="true" className="mx-1.5">·</span>
                    <span className={report.status === 'verified' ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                      {report.status === 'verified' ? 'Moderator Verified' : 'Community Signal'}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white mt-1">{report.jobTitle}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">{report.companyName}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpvote(report.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-mono-data text-slate-200 hover:border-blue-500/50 transition-colors shrink-0"
                  title="Confirm seeing this scam pattern"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-blue-400" />
                  {report.upvotes}
                </button>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">{report.description}</p>

              {(report.contactUsed || report.evidenceUrl) && (
                <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400 font-mono-data space-y-1">
                  {report.contactUsed && <div>Contact: {report.contactUsed}</div>}
                  {report.evidenceUrl && <div className="truncate">URL: {report.evidenceUrl}</div>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
