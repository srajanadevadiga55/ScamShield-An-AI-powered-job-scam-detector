import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { RiskClassification } from '../types';

interface RiskScoreGaugeProps {
  score: number;
  classification: RiskClassification;
  confidenceLevel?: string;
  analysisSource?: string;
}

export function RiskScoreGauge({
  score,
  classification,
  confidenceLevel,
  analysisSource,
}: RiskScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const tone =
    classification === 'High Risk'
      ? {
          stroke: '#EF4444',
          text: 'text-red-400',
          border: 'border-red-500/30',
          bg: 'bg-red-500/10',
          Icon: ShieldAlert,
        }
      : classification === 'Medium Risk'
        ? {
            stroke: '#F59E0B',
            text: 'text-amber-400',
            border: 'border-amber-500/30',
            bg: 'bg-amber-500/10',
            Icon: AlertTriangle,
          }
        : {
            stroke: '#10B981',
            text: 'text-emerald-400',
            border: 'border-emerald-500/30',
            bg: 'bg-emerald-500/10',
            Icon: ShieldCheck,
          };

  const StatusIcon = tone.Icon;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0D1528] p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#1E293B"
              strokeWidth="10"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={tone.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`font-mono-data text-3xl font-bold ${tone.text}`}>{clamped}</span>
            <span className="text-xs text-slate-400 font-mono-data">/ 100</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${tone.bg} ${tone.border} ${tone.text}`}
            >
              <StatusIcon className="w-4 h-4 shrink-0" />
              {classification}
            </span>

            <span className="text-xs text-slate-400">
              {confidenceLevel ? `Confidence: ${confidenceLevel}` : 'Assessment Complete'}
              <span aria-hidden="true" className="mx-2">·</span>
              {analysisSource === 'rule_based_fallback' ? 'Rule-Based Fallback Engine' : 'Gemini AI Analysis'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono-data">
              <span>0–30 Low Risk</span>
              <span>31–60 Medium Risk</span>
              <span>61–100 High Risk</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden flex">
              <div className="h-full w-[30%] bg-emerald-500/35" />
              <div className="h-full w-[30%] bg-amber-500/35" />
              <div className="h-full w-[40%] bg-red-500/35" />
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            This risk score represents an informational assessment based on the submitted details and available checks—not a guarantee of legitimacy or fraud.
          </p>
        </div>
      </div>
    </div>
  );
}
