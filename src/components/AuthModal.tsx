import { useState, useEffect } from 'react';
import { X, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { apiRequest, setStoredToken } from '../lib/api';
import type { User } from '../types';

type AuthMode = 'login' | 'register' | 'verify-otp' | 'forgot' | 'reset';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function AuthModal({ isOpen, initialMode = 'login', onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [demoCodeNotice, setDemoCodeNotice] = useState<string | null>(null);
  const [demoOtpNotice, setDemoOtpNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setInfo(null);
      setOtpCode('');
      setDemoOtpNotice(null);
      setDemoCodeNotice(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const requestRegistrationOtp = async () => {
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{
        message: string;
        email: string;
        expiresInMinutes: number;
        demoOtp?: string;
      }>('/api/auth/register/request-otp', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password }),
      });
      setInfo(res.message);
      setDemoOtpNotice(res.demoOtp || null);
      setOtpCode('');
      setMode('verify-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestRegistrationOtp();
  };

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/register/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp: otpCode.trim() }),
      });
      setDemoOtpNotice(null);
      setOtpCode('');
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; demoResetCode?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setInfo(res.message);
      if (res.demoResetCode) {
        setDemoCodeNotice(res.demoResetCode);
        setResetCode(res.demoResetCode);
      } else {
        setDemoCodeNotice(null);
        setResetCode('');
      }
      setMode('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: resetCode, newPassword: password }),
      });
      setInfo(res.message);
      setDemoCodeNotice(null);
      setPassword('');
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0D1528] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              {mode === 'login' && 'Sign in to ScamShield'}
              {mode === 'register' && 'Create your ScamShield account'}
              {mode === 'verify-otp' && 'Verify your email address'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Set a new password'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#070C18] border border-slate-800">
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setDemoOtpNotice(null);
                setDemoCodeNotice(null);
                setMode('login');
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setDemoOtpNotice(null);
                setDemoCodeNotice(null);
                setMode('register');
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{info}</p>
              {mode === 'reset' && demoCodeNotice && (
                <p className="mt-1 font-mono-data font-semibold text-white">
                  Verification Code: {demoCodeNotice}
                </p>
              )}
              {mode === 'verify-otp' && demoOtpNotice && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-[#070C18] px-2.5 py-1.5">
                  <span className="font-mono-data font-semibold text-white tracking-wider">
                    Email OTP: {demoOtpNotice}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(demoOtpNotice)}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300"
                  >
                    Fill code
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setMode('forgot');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In
            </button>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <p className="text-xs text-slate-400">Quick Demo Access</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => performLogin('demo@scamshield.sec', 'ScamShieldUser!2026')}
                  className="rounded-lg border border-slate-700 bg-[#070C18] px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-500/60 hover:text-white transition-colors"
                >
                  Demo Job Seeker
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => performLogin('admin@scamshield.sec', 'ScamShieldAdmin!2026')}
                  className="rounded-lg border border-slate-700 bg-[#070C18] px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-500/60 hover:text-white transition-colors"
                >
                  Demo Admin
                </button>
              </div>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password <span className="text-slate-400 font-normal">(min 8 chars, letters + numbers)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue & Send Email OTP
            </button>
          </form>
        )}

        {mode === 'verify-otp' && (
          <form onSubmit={handleVerifyRegisterOtp} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the 6-digit verification OTP for <span className="font-semibold text-white">{email}</span> to complete your registration.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">6-Digit Email OTP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-center text-base tracking-[0.35em] text-white font-mono-data placeholder-slate-500 placeholder:tracking-normal placeholder:text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.trim().length !== 6}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify Email & Create Account
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  resetMessages();
                  setDemoOtpNotice(null);
                  setMode('register');
                }}
                className="text-slate-400 hover:text-white"
              >
                Edit registration details
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={requestRegistrationOtp}
                className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your registered email address to generate a temporary verification code for resetting your password.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setMode('login');
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Back to Sign In
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Request Reset Code
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Verification Code</label>
              <input
                type="text"
                required
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                placeholder="8-character reset code"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white font-mono-data focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 chars (letters + numbers)"
                className="w-full rounded-lg border border-slate-700 bg-[#070C18] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
