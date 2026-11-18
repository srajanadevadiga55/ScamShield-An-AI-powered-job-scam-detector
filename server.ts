import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase, getDatabaseStatus, logSystemError } from './server/db.ts';
import {
  UserModel,
  ProfileModel,
  ScanModel,
  ScanResultModel,
  ScanHistoryModel,
  NotificationModel,
  FeedbackModel,
  SuspiciousJobReportModel,
  PasswordResetTokenModel,
  EmailVerificationOtpModel,
  ThreatIntelSourceModel,
  SystemErrorModel,
} from './server/models.ts';
import {
  createSessionToken,
  verifySessionToken,
  extractTokenFromRequest,
  rateLimit,
  sanitizeString,
  isValidEmail,
  validatePasswordStrength,
  type SessionPayload,
} from './server/security.ts';
import {
  analyzeJobPosting,
  analyzeRecruitmentEmail,
  analyzeUrlWithEvidence,
  analyzeCompanyVerification,
  runAssistantChat,
  isAiServiceConfigured,
  getActiveGeminiModel,
} from './server/ai.ts';
import { inspectUrlSafely, gatherCompanyDomainEvidence } from './server/network.ts';
import {
  isEmailDeliveryConfigured,
  sendVerificationOtpEmail,
  sendPasswordResetEmail,
  formatMailErrorMessage,
} from './server/mailer.ts';

declare global {
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Ensure MongoDB is ready before handling API routes (except /api/health for startup probes)
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') {
    next();
    return;
  }
  try {
    await initializeDatabase();
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Database not ready for API request:', msg);
    res.status(503).json({ error: 'Database is initializing. Please retry in a few seconds.' });
  }
});

async function resolveSessionUser(req: Request): Promise<SessionPayload | undefined> {
  const token = extractTokenFromRequest(req);
  const payload = verifySessionToken(token);
  if (!payload) return undefined;

  const userDoc = await UserModel.findById(payload.userId).select('email role isActive').lean();
  if (!userDoc || !userDoc.isActive) return undefined;

  return {
    ...payload,
    email: userDoc.email,
    role: userDoc.role,
  };
}

// Attach authenticated user if valid token exists
async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.user = await resolveSessionUser(req);
  } catch {
    req.user = undefined;
  }
  next();
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    req.user = await resolveSessionUser(req);
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
      return;
    }
    next();
  } catch (err) {
    logSystemError('requireAuth', err);
    res.status(500).json({ error: 'Authentication check failed.' });
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    req.user = await resolveSessionUser(req);
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator access required.' });
      return;
    }
    next();
  } catch (err) {
    logSystemError('requireAdmin', err);
    res.status(500).json({ error: 'Authorization check failed.' });
  }
}

function setSessionCookie(res: Response, token: string) {
  const isHttps = process.env.APP_URL?.startsWith('https://') || process.env.NODE_ENV === 'production';
  res.cookie('scamshield_session', token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
}

async function createNotification(
  userId: string,
  title: string,
  message: string,
  category: 'info' | 'warning' | 'success' | 'security',
  relatedScanId?: string
): Promise<void> {
  await NotificationModel.create({
    _id: crypto.randomUUID(),
    userId,
    title,
    message,
    category,
    isRead: false,
    relatedScanId: relatedScanId || null,
  });
}

async function persistScanRecord(params: {
  userId?: string;
  scanType: 'job' | 'email' | 'url' | 'company';
  subjectTitle: string;
  companyName: string;
  inputPayload: Record<string, unknown>;
  riskScore: number;
  riskClassification: 'Low Risk' | 'Medium Risk' | 'High Risk';
  confidenceLevel: string;
  analysisSource: string;
  structuredResult: Record<string, unknown>;
  summary: string;
}): Promise<string> {
  const scanId = crypto.randomUUID();
  const resultId = crypto.randomUUID();

  await ScanModel.create({
    _id: scanId,
    userId: params.userId || null,
    scanType: params.scanType,
    subjectTitle: params.subjectTitle.slice(0, 200),
    companyName: params.companyName.slice(0, 200),
    inputPayload: params.inputPayload,
  });

  await ScanResultModel.create({
    _id: resultId,
    scanId,
    riskScore: params.riskScore,
    riskClassification: params.riskClassification,
    confidenceLevel: params.confidenceLevel,
    analysisSource: params.analysisSource,
    structuredResult: params.structuredResult,
    summary: params.summary.slice(0, 1000),
  });

  if (params.userId) {
    const jobOrCompanyName = (
      params.companyName && params.companyName !== 'Unspecified Company'
        ? `${params.subjectTitle} — ${params.companyName}`
        : params.subjectTitle
    ).slice(0, 200);

    await ScanHistoryModel.create({
      _id: crypto.randomUUID(),
      userId: params.userId,
      scanId,
      scanType: params.scanType,
      jobOrCompanyName,
      riskScore: params.riskScore,
      riskClassification: params.riskClassification,
      analysisSummary: params.summary.slice(0, 500),
    });

    const prefs = await ProfileModel.findOne({ userId: params.userId })
      .select('notifyHighRisk')
      .lean();

    if (params.riskClassification === 'High Risk') {
      if (prefs?.notifyHighRisk !== false) {
        await createNotification(
          params.userId,
          'High-risk indicators detected',
          `Your ${params.scanType} scan for "${params.subjectTitle}" scored ${params.riskScore}/100. Review the safety recommendations before responding.`,
          'warning',
          scanId
        );
      }
    } else {
      await createNotification(
        params.userId,
        'Scan completed',
        `Your ${params.scanType} analysis for "${params.subjectTitle}" finished with a ${params.riskClassification} score (${params.riskScore}/100).`,
        'success',
        scanId
      );
    }
  }

  return scanId;
}

// =======================
// HEALTH & PUBLIC STATS
// =======================
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    stack: 'MERN (MongoDB, Express, React, Node.js)',
    database: getDatabaseStatus(),
    aiConfigured: isAiServiceConfigured(),
    emailConfigured: isEmailDeliveryConfigured(),
  });
});

// =======================
// AUTHENTICATION ROUTES
// =======================
async function issueRegistrationOtp(params: { fullName: string; email: string; password: string }) {
  const { fullName, email, password } = params;
  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
  const passwordHash = bcrypt.hashSync(password, 10);
  const expiresAt = new Date(Date.now() + 10 * 60_000);

  await EmailVerificationOtpModel.updateMany({ email, used: false }, { $set: { used: true } });
  await EmailVerificationOtpModel.create({
    _id: crypto.randomUUID(),
    email,
    fullName,
    passwordHash,
    otpHash,
    expiresAt,
    attempts: 0,
    used: false,
  });

  return { rawOtp, expiresInMinutes: 10 };
}

async function completeRegistrationWithOtp(params: { email: string; otp: string; res: Response }) {
  const { email, otp, res } = params;

  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ error: 'Please provide your email address and the 6-digit verification OTP.' });
    return;
  }

  const otpDoc = await EmailVerificationOtpModel.findOne({ email, used: false })
    .sort({ createdAt: -1 })
    .lean();

  if (!otpDoc || new Date(otpDoc.expiresAt).getTime() < Date.now()) {
    res.status(400).json({ error: 'Verification OTP is invalid or has expired. Please request a new code.' });
    return;
  }

  if (otpDoc.attempts >= 5) {
    await EmailVerificationOtpModel.updateOne({ _id: otpDoc._id }, { $set: { used: true } });
    res.status(429).json({ error: 'Too many incorrect OTP attempts. Please request a new OTP.' });
    return;
  }

  const submittedHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (submittedHash !== otpDoc.otpHash) {
    const nextAttempts = otpDoc.attempts + 1;
    const remaining = Math.max(0, 5 - nextAttempts);
    await EmailVerificationOtpModel.updateOne(
      { _id: otpDoc._id },
      { $set: { attempts: nextAttempts, ...(remaining === 0 ? { used: true } : {}) } }
    );
    res.status(remaining > 0 ? 400 : 429).json({
      error:
        remaining > 0
          ? `Invalid verification OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect OTP attempts. Please request a new OTP.',
    });
    return;
  }

  const existing = await UserModel.findOne({ email }).select('_id').lean();
  if (existing) {
    await EmailVerificationOtpModel.updateOne({ _id: otpDoc._id }, { $set: { used: true } });
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  await EmailVerificationOtpModel.updateOne({ _id: otpDoc._id }, { $set: { used: true } });

  const userId = crypto.randomUUID();
  await UserModel.create({
    _id: userId,
    email,
    passwordHash: otpDoc.passwordHash,
    role: 'user',
    isActive: true,
    emailVerified: true,
  });

  await ProfileModel.create({
    _id: crypto.randomUUID(),
    userId,
    fullName: otpDoc.fullName,
    jobSearchStatus: 'Actively Applying',
    notifyHighRisk: true,
    notifyReports: true,
    emailDigest: false,
  });

  await createNotification(
    userId,
    'Welcome to ScamShield',
    'Your email has been verified and your personal security workspace is ready. Scans you run while signed in are saved privately to your history.',
    'info'
  );

  const token = createSessionToken({ userId, email, role: 'user' });
  setSessionCookie(res, token);

  res.status(201).json({
    token,
    user: {
      id: userId,
      email,
      role: 'user',
      fullName: otpDoc.fullName,
      jobSearchStatus: 'Actively Applying',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      preferences: {
        notifyHighRisk: true,
        notifyReports: true,
        emailDigest: false,
      },
    },
  });
}

app.post('/api/auth/register/request-otp', rateLimit('auth', 20, 60_000), async (req, res) => {
  try {
    const fullName = sanitizeString(req.body?.fullName, 100);
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      res.status(400).json({ error: pwdError });
      return;
    }

    const existing = await UserModel.findOne({ email }).select('_id').lean();
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const { rawOtp, expiresInMinutes } = await issueRegistrationOtp({ fullName, email, password });

    if (isEmailDeliveryConfigured()) {
      try {
        await sendVerificationOtpEmail({ to: email, fullName, otp: rawOtp, expiresInMinutes });
      } catch (mailErr) {
        logSystemError('/api/auth/register/request-otp mail', mailErr);
        res.status(502).json({
          error: formatMailErrorMessage(mailErr),
        });
        return;
      }

      res.json({
        emailSent: true,
        message: `A 6-digit verification OTP has been sent to ${email} (valid for ${expiresInMinutes} minutes). Please check your inbox and spam folder.`,
        email,
        expiresInMinutes,
      });
      return;
    }

    res.json({
      emailSent: false,
      message: `A 6-digit verification OTP has been generated for ${email} (valid for ${expiresInMinutes} minutes). Because SMTP email delivery is not configured yet, use the temporary OTP below—or add SMTP_USER & SMTP_PASS in Secrets to send OTPs directly to your inbox.`,
      email,
      expiresInMinutes,
      demoOtp: rawOtp,
    });
  } catch (err) {
    logSystemError('/api/auth/register/request-otp', err);
    res.status(500).json({ error: 'Unable to generate verification OTP right now.' });
  }
});

app.post('/api/auth/register/verify-otp', rateLimit('auth', 20, 60_000), async (req, res) => {
  try {
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const otp = sanitizeString(req.body?.otp, 12).replace(/\s+/g, '');
    await completeRegistrationWithOtp({ email, otp, res });
  } catch (err) {
    logSystemError('/api/auth/register/verify-otp', err);
    res.status(500).json({ error: 'Unable to verify OTP right now.' });
  }
});

app.post('/api/auth/register', rateLimit('auth', 20, 60_000), async (req, res) => {
  try {
    const fullName = sanitizeString(req.body?.fullName, 100);
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const otp = sanitizeString(req.body?.otp, 12).replace(/\s+/g, '');

    if (otp) {
      await completeRegistrationWithOtp({ email, otp, res });
      return;
    }

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      res.status(400).json({ error: pwdError });
      return;
    }

    const existing = await UserModel.findOne({ email }).select('_id').lean();
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const { rawOtp, expiresInMinutes } = await issueRegistrationOtp({ fullName, email, password });

    if (isEmailDeliveryConfigured()) {
      try {
        await sendVerificationOtpEmail({ to: email, fullName, otp: rawOtp, expiresInMinutes });
      } catch (mailErr) {
        logSystemError('/api/auth/register mail', mailErr);
        res.status(502).json({
          error: formatMailErrorMessage(mailErr),
        });
        return;
      }

      res.status(202).json({
        requiresOtpVerification: true,
        emailSent: true,
        message: `A 6-digit verification OTP has been sent to ${email} (valid for ${expiresInMinutes} minutes). Please check your inbox and spam folder.`,
        email,
        expiresInMinutes,
      });
      return;
    }

    res.status(202).json({
      requiresOtpVerification: true,
      emailSent: false,
      message: `A 6-digit verification OTP has been generated for ${email} (valid for ${expiresInMinutes} minutes). Because SMTP email delivery is not configured yet, use the temporary OTP below—or add SMTP_USER & SMTP_PASS in Secrets to send OTPs directly to your inbox.`,
      email,
      expiresInMinutes,
      demoOtp: rawOtp,
    });
  } catch (err) {
    logSystemError('/api/auth/register', err);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

app.post('/api/auth/login', rateLimit('auth', 25, 60_000), async (req, res) => {
  try {
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Please enter a valid email and password.' });
      return;
    }

    const user = await UserModel.findOne({ email }).lean();
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated.' });
      return;
    }

    const profile = await ProfileModel.findOne({ userId: user._id }).lean();

    const token = createSessionToken({ userId: user._id, email: user.email, role: user.role });
    setSessionCookie(res, token);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: profile?.fullName || 'ScamShield Member',
        jobSearchStatus: profile?.jobSearchStatus || 'Actively Applying',
        emailVerified: user.emailVerified ?? true,
        createdAt: user.createdAt.toISOString(),
        preferences: {
          notifyHighRisk: profile ? Boolean(profile.notifyHighRisk) : true,
          notifyReports: profile ? Boolean(profile.notifyReports) : true,
          emailDigest: profile ? Boolean(profile.emailDigest) : false,
        },
      },
    });
  } catch (err) {
    logSystemError('/api/auth/login', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('scamshield_session', { path: '/' });
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', rateLimit('auth', 10, 60_000), async (req, res) => {
  try {
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const user = await UserModel.findOne({ email }).select('_id').lean();
    if (!user) {
      res.json({
        message: 'If an account matches that email address, a password reset code has been issued.',
      });
      return;
    }

    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    await PasswordResetTokenModel.create({
      _id: crypto.randomUUID(),
      userId: user._id,
      tokenHash,
      expiresAt,
      used: false,
    });

    if (isEmailDeliveryConfigured()) {
      try {
        await sendPasswordResetEmail({ to: email, code: rawCode, expiresInMinutes: 15 });
      } catch (mailErr) {
        logSystemError('/api/auth/forgot-password mail', mailErr);
        res.status(502).json({
          error: formatMailErrorMessage(mailErr),
        });
        return;
      }

      res.json({
        emailSent: true,
        message: 'A password reset verification code has been sent to your email address (valid for 15 minutes).',
      });
      return;
    }

    res.json({
      emailSent: false,
      message:
        'Reset code generated (valid for 15 minutes). SMTP email delivery is not configured yet—enter the temporary verification code below.',
      demoResetCode: rawCode,
    });
  } catch (err) {
    logSystemError('/api/auth/forgot-password', err);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

app.post('/api/auth/reset-password', rateLimit('auth', 15, 60_000), async (req, res) => {
  try {
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const code = sanitizeString(req.body?.code, 32).toUpperCase();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!isValidEmail(email) || !code) {
      res.status(400).json({ error: 'Email and reset code are required.' });
      return;
    }
    const pwdErr = validatePasswordStrength(newPassword);
    if (pwdErr) {
      res.status(400).json({ error: pwdErr });
      return;
    }

    const user = await UserModel.findOne({ email }).select('_id').lean();
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const tokenRow = await PasswordResetTokenModel.findOne({
      userId: user._id,
      tokenHash,
      used: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!tokenRow || new Date(tokenRow.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await UserModel.updateOne({ _id: user._id }, { $set: { passwordHash: newHash } });
    await PasswordResetTokenModel.updateOne({ _id: tokenRow._id }, { $set: { used: true } });
    await createNotification(
      user._id,
      'Password updated',
      'Your account password was successfully reset.',
      'security'
    );

    res.json({ message: 'Password updated successfully. You can now sign in with your new password.' });
  } catch (err) {
    logSystemError('/api/auth/reset-password', err);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

app.get('/api/auth/me', optionalAuth, async (req, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }

  try {
    const [user, profile, unreadCount] = await Promise.all([
      UserModel.findById(req.user.userId).select('email role emailVerified createdAt').lean(),
      ProfileModel.findOne({ userId: req.user.userId }).lean(),
      NotificationModel.countDocuments({ userId: req.user.userId, isRead: false }),
    ]);

    if (!user) {
      res.json({ user: null });
      return;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified ?? true,
        createdAt: user.createdAt.toISOString(),
        fullName: profile?.fullName || 'ScamShield Member',
        jobSearchStatus: profile?.jobSearchStatus || 'Actively Applying',
        unreadNotifications: unreadCount,
        preferences: {
          notifyHighRisk: profile ? Boolean(profile.notifyHighRisk) : true,
          notifyReports: profile ? Boolean(profile.notifyReports) : true,
          emailDigest: profile ? Boolean(profile.emailDigest) : false,
        },
      },
    });
  } catch (err) {
    logSystemError('/api/auth/me', err);
    res.status(500).json({ error: 'Unable to load session user.' });
  }
});

// =======================
// PROFILE & SETTINGS
// =======================
app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const fullName = sanitizeString(req.body?.fullName, 100);
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const jobSearchStatus = sanitizeString(req.body?.jobSearchStatus, 80) || 'Actively Applying';
    const notifyHighRisk = Boolean(req.body?.preferences?.notifyHighRisk);
    const notifyReports = Boolean(req.body?.preferences?.notifyReports);
    const emailDigest = Boolean(req.body?.preferences?.emailDigest);

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    if (email !== req.user!.email) {
      const taken = await UserModel.findOne({ email, _id: { $ne: req.user!.userId } })
        .select('_id')
        .lean();
      if (taken) {
        res.status(409).json({ error: 'That email address is already in use by another account.' });
        return;
      }
    }

    await UserModel.updateOne({ _id: req.user!.userId }, { $set: { email } });
    await ProfileModel.updateOne(
      { userId: req.user!.userId },
      {
        $set: {
          fullName,
          jobSearchStatus,
          notifyHighRisk,
          notifyReports,
          emailDigest,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await createNotification(
      req.user!.userId,
      'Profile updated',
      'Your account profile and notification preferences have been saved.',
      'info'
    );

    const updatedUser = await UserModel.findById(req.user!.userId).select('emailVerified createdAt').lean();
    const newToken = createSessionToken({ userId: req.user!.userId, email, role: req.user!.role });
    setSessionCookie(res, newToken);

    res.json({
      token: newToken,
      user: {
        id: req.user!.userId,
        email,
        role: req.user!.role,
        fullName,
        jobSearchStatus,
        emailVerified: updatedUser?.emailVerified ?? true,
        createdAt: updatedUser?.createdAt?.toISOString(),
        preferences: {
          notifyHighRisk,
          notifyReports,
          emailDigest,
        },
      },
    });
  } catch (err) {
    logSystemError('/api/profile', err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

app.post('/api/profile/change-password', requireAuth, async (req, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const user = await UserModel.findById(req.user!.userId).select('passwordHash').lean();

    if (!user || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const pwdErr = validatePasswordStrength(newPassword);
    if (pwdErr) {
      res.status(400).json({ error: pwdErr });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await UserModel.updateOne({ _id: req.user!.userId }, { $set: { passwordHash: newHash } });
    await createNotification(
      req.user!.userId,
      'Password changed',
      'Your account password has been updated.',
      'security'
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    logSystemError('/api/profile/change-password', err);
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

app.delete('/api/profile', requireAuth, async (req, res) => {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = await UserModel.findById(req.user!.userId).select('passwordHash role').lean();

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      res.status(401).json({ error: 'Password confirmation failed.' });
      return;
    }

    if (user.role === 'admin') {
      res.status(400).json({ error: 'Primary administrator account cannot be self-deleted.' });
      return;
    }

    const userScans = await ScanModel.find({ userId: req.user!.userId }).select('_id').lean();
    const scanIds = userScans.map((s) => s._id);

    await Promise.all([
      ProfileModel.deleteOne({ userId: req.user!.userId }),
      ScanHistoryModel.deleteMany({ userId: req.user!.userId }),
      ScanResultModel.deleteMany({ scanId: { $in: scanIds } }),
      ScanModel.deleteMany({ userId: req.user!.userId }),
      NotificationModel.deleteMany({ userId: req.user!.userId }),
      PasswordResetTokenModel.deleteMany({ userId: req.user!.userId }),
      UserModel.deleteOne({ _id: req.user!.userId }),
    ]);

    res.clearCookie('scamshield_session', { path: '/' });
    res.json({ message: 'Your account and personal scan data have been permanently deleted.' });
  } catch (err) {
    logSystemError('/api/profile DELETE', err);
    res.status(500).json({ error: 'Unable to delete account.' });
  }
});

// =======================
// AI SCANNING ENDPOINTS
// =======================
app.post('/api/scans/job', optionalAuth, rateLimit('scan', 25, 60_000), async (req, res) => {
  try {
    const jobTitle = sanitizeString(req.body?.jobTitle, 160);
    const companyName = sanitizeString(req.body?.companyName, 160);
    const recruiterInfo = sanitizeString(req.body?.recruiterInfo, 300);
    const salaryDetails = sanitizeString(req.body?.salaryDetails, 160);
    const jobLocation = sanitizeString(req.body?.jobLocation, 160);
    const applicationUrl = sanitizeString(req.body?.applicationUrl, 500);
    const jobDescription = sanitizeString(req.body?.jobDescription, 12000);

    if (!jobTitle || !companyName || !recruiterInfo || !salaryDetails || !jobLocation) {
      res.status(400).json({ error: 'Please provide Job Title, Company Name, Recruiter Information, Salary Details, and Job Location (only Application URL is optional).' });
      return;
    }

    if (jobDescription.length < 30) {
      res.status(400).json({ error: 'Please paste at least 30 characters of the job description to analyze.' });
      return;
    }

    const analysis = await analyzeJobPosting({
      jobTitle,
      companyName,
      recruiterInfo,
      salaryDetails,
      jobLocation,
      applicationUrl,
      jobDescription,
    });

    const scanId = await persistScanRecord({
      userId: req.user?.userId,
      scanType: 'job',
      subjectTitle: analysis.jobTitle,
      companyName: analysis.companyName,
      inputPayload: { jobTitle, companyName, recruiterInfo, salaryDetails, jobLocation, applicationUrl, jobDescription },
      riskScore: analysis.riskScore,
      riskClassification: analysis.riskClassification,
      confidenceLevel: analysis.confidenceLevel,
      analysisSource: analysis.analysisSource,
      structuredResult: analysis as unknown as Record<string, unknown>,
      summary: analysis.finalAssessment,
    });

    res.json({
      scanId,
      savedToHistory: Boolean(req.user),
      createdAt: new Date().toISOString(),
      result: analysis,
    });
  } catch (err) {
    logSystemError('/api/scans/job', err);
    res.status(500).json({ error: 'Job scam analysis failed. Please try again.' });
  }
});

app.post('/api/scans/email', optionalAuth, rateLimit('scan', 25, 60_000), async (req, res) => {
  try {
    const senderEmail = sanitizeString(req.body?.senderEmail, 254);
    const subject = sanitizeString(req.body?.subject, 250);
    const emailBody = sanitizeString(req.body?.emailBody, 10000);

    if (emailBody.length < 25) {
      res.status(400).json({ error: 'Please paste at least 25 characters of the recruitment email body.' });
      return;
    }

    const analysis = await analyzeRecruitmentEmail({ senderEmail, subject, emailBody });

    const scanId = await persistScanRecord({
      userId: req.user?.userId,
      scanType: 'email',
      subjectTitle: subject || senderEmail || 'Recruitment Email Scan',
      companyName: senderEmail || 'Email Sender',
      inputPayload: { senderEmail, subject, emailBody },
      riskScore: analysis.riskScore,
      riskClassification: analysis.riskClassification,
      confidenceLevel: analysis.confidenceLevel,
      analysisSource: analysis.analysisSource,
      structuredResult: analysis as unknown as Record<string, unknown>,
      summary: analysis.explanation,
    });

    res.json({
      scanId,
      savedToHistory: Boolean(req.user),
      createdAt: new Date().toISOString(),
      result: analysis,
    });
  } catch (err) {
    logSystemError('/api/scans/email', err);
    res.status(500).json({ error: 'Email analysis failed. Please try again.' });
  }
});

app.post('/api/scans/url', optionalAuth, rateLimit('scan', 25, 60_000), async (req, res) => {
  try {
    const rawUrl = sanitizeString(req.body?.url, 1000);
    if (!rawUrl || rawUrl.length < 4) {
      res.status(400).json({ error: 'Please enter a valid job application URL to inspect.' });
      return;
    }

    const inspection = await inspectUrlSafely(rawUrl);
    if (!inspection.isSafeToFetch && inspection.blockReason?.toLowerCase().includes('blocked')) {
      res.status(400).json({ error: inspection.blockReason });
      return;
    }

    const analysis = await analyzeUrlWithEvidence(rawUrl, inspection);

    const scanId = await persistScanRecord({
      userId: req.user?.userId,
      scanType: 'url',
      subjectTitle: inspection.hostname || rawUrl.slice(0, 80),
      companyName: inspection.hostname || 'URL Check',
      inputPayload: { url: rawUrl },
      riskScore: analysis.riskScore,
      riskClassification: analysis.riskClassification,
      confidenceLevel: analysis.confidenceLevel,
      analysisSource: analysis.analysisSource,
      structuredResult: analysis as unknown as Record<string, unknown>,
      summary: analysis.explanation,
    });

    res.json({
      scanId,
      savedToHistory: Boolean(req.user),
      createdAt: new Date().toISOString(),
      result: analysis,
    });
  } catch (err) {
    logSystemError('/api/scans/url', err);
    res.status(500).json({ error: 'URL inspection failed. Please try again.' });
  }
});

app.post('/api/scans/company', optionalAuth, rateLimit('scan', 25, 60_000), async (req, res) => {
  try {
    const companyName = sanitizeString(req.body?.companyName, 160);
    const officialWebsite = sanitizeString(req.body?.officialWebsite, 400);
    const companyEmail = sanitizeString(req.body?.companyEmail, 254);
    const location = sanitizeString(req.body?.location, 200);
    const registrationDetails = sanitizeString(req.body?.registrationDetails, 250);

    if (companyName.length < 2) {
      res.status(400).json({ error: 'Please enter the company name to verify.' });
      return;
    }

    const domainEvidence = await gatherCompanyDomainEvidence(officialWebsite, companyEmail);
    const verification = await analyzeCompanyVerification(
      { companyName, officialWebsite, companyEmail, location, registrationDetails },
      domainEvidence
    );

    const scanId = await persistScanRecord({
      userId: req.user?.userId,
      scanType: 'company',
      subjectTitle: companyName,
      companyName,
      inputPayload: { companyName, officialWebsite, companyEmail, location, registrationDetails },
      riskScore: verification.riskScore,
      riskClassification: verification.riskClassification,
      confidenceLevel: 'Medium',
      analysisSource: verification.analysisSource,
      structuredResult: verification as unknown as Record<string, unknown>,
      summary: verification.overallAssessment,
    });

    res.json({
      scanId,
      savedToHistory: Boolean(req.user),
      createdAt: new Date().toISOString(),
      result: verification,
    });
  } catch (err) {
    logSystemError('/api/scans/company', err);
    res.status(500).json({ error: 'Company verification failed. Please try again.' });
  }
});

// =======================
// DASHBOARD & SCAN HISTORY
// =======================
app.get('/api/dashboard/overview', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [totalsAgg, recentHistory, byTypeAgg, trendAgg] = await Promise.all([
      ScanHistoryModel.aggregate<{
        totalScans: number;
        highRisk: number;
        mediumRisk: number;
        lowRisk: number;
      }>([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalScans: { $sum: 1 },
            highRisk: { $sum: { $cond: [{ $eq: ['$riskClassification', 'High Risk'] }, 1, 0] } },
            mediumRisk: { $sum: { $cond: [{ $eq: ['$riskClassification', 'Medium Risk'] }, 1, 0] } },
            lowRisk: { $sum: { $cond: [{ $eq: ['$riskClassification', 'Low Risk'] }, 1, 0] } },
          },
        },
      ]),
      ScanHistoryModel.find({ userId }).sort({ createdAt: -1 }).limit(8).lean(),
      ScanHistoryModel.aggregate<{
        scanType: string;
        count: number;
        avgScore: number;
        highRiskCount: number;
      }>([
        { $match: { userId } },
        {
          $group: {
            _id: '$scanType',
            count: { $sum: 1 },
            avgScoreRaw: { $avg: '$riskScore' },
            highRiskCount: { $sum: { $cond: [{ $eq: ['$riskClassification', 'High Risk'] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            scanType: '$_id',
            count: 1,
            avgScore: { $round: ['$avgScoreRaw', 0] },
            highRiskCount: 1,
          },
        },
      ]),
      ScanHistoryModel.aggregate<{
        day: string;
        total: number;
        jobHighRisk: number;
        emailHighRisk: number;
        urlScans: number;
      }>([
        { $match: { userId } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: 1 },
            jobHighRisk: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$scanType', 'job'] }, { $eq: ['$riskClassification', 'High Risk'] }] },
                  1,
                  0,
                ],
              },
            },
            emailHighRisk: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$scanType', 'email'] }, { $eq: ['$riskClassification', 'High Risk'] }] },
                  1,
                  0,
                ],
              },
            },
            urlScans: {
              $sum: { $cond: [{ $eq: ['$scanType', 'url'] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
        {
          $project: {
            _id: 0,
            day: '$_id',
            total: 1,
            jobHighRisk: 1,
            emailHighRisk: 1,
            urlScans: 1,
          },
        },
      ]),
    ]);

    const recentScanIds = recentHistory.map((h) => h.scanId);
    const linkedScans = await ScanModel.find({ _id: { $in: recentScanIds } })
      .select('_id subjectTitle companyName')
      .lean();
    const scanMetaById = new Map(linkedScans.map((s) => [s._id, s]));

    const recentScans = recentHistory.map((h) => {
      const meta = scanMetaById.get(h.scanId);
      return {
        id: h._id,
        scanId: h.scanId,
        scanType: h.scanType,
        jobOrCompanyName: h.jobOrCompanyName,
        riskScore: h.riskScore,
        riskClassification: h.riskClassification,
        analysisSummary: h.analysisSummary,
        createdAt: h.createdAt.toISOString(),
        subjectTitle: meta?.subjectTitle || h.jobOrCompanyName,
        companyName: meta?.companyName || '',
      };
    });

    const stats = totalsAgg[0] || { totalScans: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 };

    res.json({
      totals: {
        totalScans: stats.totalScans || 0,
        highRisk: stats.highRisk || 0,
        mediumRisk: stats.mediumRisk || 0,
        lowRisk: stats.lowRisk || 0,
      },
      recentScans,
      byType: byTypeAgg,
      trendByDay: trendAgg,
    });
  } catch (err) {
    logSystemError('/api/dashboard/overview', err);
    res.status(500).json({ error: 'Unable to load dashboard analytics.' });
  }
});

app.get('/api/scans/history', requireAuth, async (req, res) => {
  try {
    const search = sanitizeString(req.query.q, 100);
    const riskFilter = sanitizeString(req.query.risk, 30);
    const typeFilter = sanitizeString(req.query.type, 20);

    const filter: Record<string, unknown> = { userId: req.user!.userId };

    if (riskFilter && ['Low Risk', 'Medium Risk', 'High Risk'].includes(riskFilter)) {
      filter.riskClassification = riskFilter;
    }
    if (typeFilter && ['job', 'email', 'url', 'company'].includes(typeFilter)) {
      filter.scanType = typeFilter;
    }
    if (search) {
      const regex = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ jobOrCompanyName: regex }, { analysisSummary: regex }];
    }

    const docs = await ScanHistoryModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();

    const items = docs.map((h) => ({
      id: h._id,
      scanId: h.scanId,
      scanType: h.scanType,
      jobOrCompanyName: h.jobOrCompanyName,
      riskScore: h.riskScore,
      riskClassification: h.riskClassification,
      analysisSummary: h.analysisSummary,
      createdAt: h.createdAt.toISOString(),
    }));

    res.json({ items });
  } catch (err) {
    logSystemError('/api/scans/history', err);
    res.status(500).json({ error: 'Failed to retrieve scan history.' });
  }
});

app.get('/api/scans/:scanId', optionalAuth, async (req, res) => {
  try {
    const scanId = sanitizeString(req.params.scanId, 64);
    const [scan, result] = await Promise.all([
      ScanModel.findById(scanId).lean(),
      ScanResultModel.findOne({ scanId }).lean(),
    ]);

    if (!scan || !result) {
      res.status(404).json({ error: 'Scan report not found.' });
      return;
    }

    // Enforce user-level data isolation when scan belongs to a user
    if (scan.userId && (!req.user || (req.user.userId !== scan.userId && req.user.role !== 'admin'))) {
      res.status(403).json({ error: 'You do not have permission to view this scan report.' });
      return;
    }

    res.json({
      scanId: scan._id,
      scanType: scan.scanType,
      subjectTitle: scan.subjectTitle,
      companyName: scan.companyName,
      createdAt: scan.createdAt.toISOString(),
      inputPayload: scan.inputPayload,
      result: result.structuredResult,
    });
  } catch (err) {
    logSystemError('/api/scans/:scanId', err);
    res.status(500).json({ error: 'Could not retrieve scan report.' });
  }
});

app.delete('/api/scans/history/:scanId', requireAuth, async (req, res) => {
  try {
    const scanId = sanitizeString(req.params.scanId, 64);
    const deleted = await ScanHistoryModel.deleteOne({ scanId, userId: req.user!.userId });
    if (deleted.deletedCount === 0) {
      res.status(404).json({ error: 'Scan record not found.' });
      return;
    }
    await Promise.all([
      ScanResultModel.deleteOne({ scanId }),
      ScanModel.deleteOne({ _id: scanId, userId: req.user!.userId }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/scans/history/:scanId DELETE', err);
    res.status(500).json({ error: 'Unable to delete scan record.' });
  }
});

app.delete('/api/scans/history', requireAuth, async (req, res) => {
  try {
    const userScans = await ScanModel.find({ userId: req.user!.userId }).select('_id').lean();
    const scanIds = userScans.map((s) => s._id);

    await Promise.all([
      ScanHistoryModel.deleteMany({ userId: req.user!.userId }),
      ScanResultModel.deleteMany({ scanId: { $in: scanIds } }),
      ScanModel.deleteMany({ userId: req.user!.userId }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/scans/history DELETE', err);
    res.status(500).json({ error: 'Unable to clear scan history.' });
  }
});

// =======================
// NOTIFICATIONS
// =======================
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const docs = await NotificationModel.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    const items = docs.map((n) => ({
      id: n._id,
      title: n.title,
      message: n.message,
      category: n.category,
      isRead: n.isRead ? 1 : 0,
      relatedScanId: n.relatedScanId,
      createdAt: n.createdAt.toISOString(),
    }));

    res.json({ items });
  } catch (err) {
    logSystemError('/api/notifications', err);
    res.status(500).json({ error: 'Unable to load notifications.' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const id = sanitizeString(req.params.id, 64);
    await NotificationModel.updateOne({ _id: id, userId: req.user!.userId }, { $set: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/notifications/:id/read', err);
    res.status(500).json({ error: 'Unable to update notification.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await NotificationModel.updateMany({ userId: req.user!.userId }, { $set: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/notifications/read-all', err);
    res.status(500).json({ error: 'Unable to update notifications.' });
  }
});

app.post('/api/notifications/report-generated', requireAuth, async (req, res) => {
  try {
    const subject = sanitizeString(req.body?.subject, 120) || 'Analysis Report';
    const scanId = sanitizeString(req.body?.scanId, 64) || undefined;
    const profile = await ProfileModel.findOne({ userId: req.user!.userId })
      .select('notifyReports')
      .lean();

    if (profile?.notifyReports !== false) {
      await createNotification(
        req.user!.userId,
        'PDF report downloaded',
        `A downloadable PDF safety report was generated for "${subject}".`,
        'info',
        scanId
      );
    }
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/notifications/report-generated', err);
    res.status(500).json({ error: 'Unable to record notification.' });
  }
});

// =======================
// SCAMSHIELD ASSISTANT CHAT
// =======================
app.post('/api/assistant/chat', optionalAuth, rateLimit('chat', 30, 60_000), async (req, res) => {
  try {
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const scanContext = sanitizeString(req.body?.scanContext, 2000);

    const messages = rawMessages
      .filter((m: unknown) => typeof m === 'object' && m !== null)
      .map((m: { role?: unknown; content?: unknown }) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: sanitizeString(m.content, 2000),
      }))
      .filter((m: { content: string }) => m.content.length > 0);

    if (messages.length === 0) {
      res.status(400).json({ error: 'Please enter a question for ScamShield Assistant.' });
      return;
    }

    const result = await runAssistantChat(messages, scanContext);
    res.json(result);
  } catch (err) {
    logSystemError('/api/assistant/chat', err);
    res.status(500).json({ error: 'ScamShield Assistant could not respond right now.' });
  }
});

// =======================
// CONTACT & COMMUNITY SCAM REPORTS
// =======================
app.post('/api/contact', optionalAuth, rateLimit('contact', 6, 60_000), async (req, res) => {
  try {
    // Honeypot field for spam prevention
    if (req.body?.websiteField) {
      res.status(200).json({ message: 'Thank you for your message.' });
      return;
    }

    const name = sanitizeString(req.body?.name, 100);
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const subject = sanitizeString(req.body?.subject, 150);
    const message = sanitizeString(req.body?.message, 3000);

    if (name.length < 2) {
      res.status(400).json({ error: 'Please enter your name.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (subject.length < 3 || message.length < 10) {
      res.status(400).json({ error: 'Please provide a clear subject and message (at least 10 characters).' });
      return;
    }

    await FeedbackModel.create({
      _id: crypto.randomUUID(),
      userId: req.user?.userId || null,
      name,
      email,
      subject,
      message,
      status: 'new',
    });

    res.status(201).json({ message: 'Your message has been received by the ScamShield team.' });
  } catch (err) {
    logSystemError('/api/contact', err);
    res.status(500).json({ error: 'Unable to submit feedback right now.' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const search = sanitizeString(req.query.q, 100);
    const statusFilter = sanitizeString(req.query.status, 20);

    const filter: Record<string, unknown> = { status: { $ne: 'dismissed' } };

    if (statusFilter === 'verified' || statusFilter === 'pending') {
      filter.status = statusFilter;
    }
    if (search) {
      const regex = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ jobTitle: regex }, { companyName: regex }, { description: regex }];
    }

    const docs = await SuspiciousJobReportModel.find(filter)
      .sort({ upvotes: -1, createdAt: -1 })
      .limit(60)
      .lean();

    const items = docs.map((r) => ({
      id: r._id,
      jobTitle: r.jobTitle,
      companyName: r.companyName,
      scamType: r.scamType,
      platformSource: r.platformSource,
      contactUsed: r.contactUsed,
      description: r.description,
      evidenceUrl: r.evidenceUrl,
      status: r.status,
      upvotes: r.upvotes,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({ items });
  } catch (err) {
    logSystemError('/api/reports GET', err);
    res.status(500).json({ error: 'Failed to load community scam reports.' });
  }
});

app.post('/api/reports', optionalAuth, rateLimit('reports', 8, 60_000), async (req, res) => {
  try {
    const jobTitle = sanitizeString(req.body?.jobTitle, 160);
    const companyName = sanitizeString(req.body?.companyName, 160);
    const scamType = sanitizeString(req.body?.scamType, 100);
    const platformSource = sanitizeString(req.body?.platformSource, 100);
    const contactUsed = sanitizeString(req.body?.contactUsed, 200);
    const description = sanitizeString(req.body?.description, 2500);
    const evidenceUrl = sanitizeString(req.body?.evidenceUrl, 400);

    if (jobTitle.length < 3 || companyName.length < 2 || description.length < 20) {
      res.status(400).json({
        error: 'Please enter the job title, company name, and a clear description (at least 20 characters).',
      });
      return;
    }

    const id = crypto.randomUUID();
    await SuspiciousJobReportModel.create({
      _id: id,
      userId: req.user?.userId || null,
      jobTitle,
      companyName,
      scamType: scamType || 'Suspicious Recruitment Offer',
      platformSource: platformSource || 'Other',
      contactUsed,
      description,
      evidenceUrl,
      status: 'pending',
      upvotes: 1,
    });

    res.status(201).json({
      id,
      message: 'Suspicious listing report submitted for community visibility and moderator review.',
    });
  } catch (err) {
    logSystemError('/api/reports POST', err);
    res.status(500).json({ error: 'Could not submit suspicious job report.' });
  }
});

app.post('/api/reports/:id/upvote', rateLimit('upvote', 20, 60_000), async (req, res) => {
  try {
    const id = sanitizeString(req.params.id, 64);
    const updated = await SuspiciousJobReportModel.findOneAndUpdate(
      { _id: id, status: { $ne: 'dismissed' } },
      { $inc: { upvotes: 1 } },
      { new: true }
    )
      .select('upvotes')
      .lean();

    if (!updated) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    res.json({ upvotes: updated.upvotes });
  } catch (err) {
    logSystemError('/api/reports/:id/upvote', err);
    res.status(500).json({ error: 'Could not upvote report.' });
  }
});

// =======================
// ADMIN DASHBOARD ROUTES
// =======================
app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const [
      userDocs,
      profileDocs,
      userScanCounts,
      scanStatsAgg,
      scansByTypeAgg,
      reportDocs,
      feedbackDocs,
      threatSourceDocs,
      systemErrorDocs,
    ] = await Promise.all([
      UserModel.find().sort({ createdAt: -1 }).lean(),
      ProfileModel.find().select('userId fullName').lean(),
      ScanModel.aggregate<{ _id: string; count: number }>([
        { $match: { userId: { $ne: null } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
      ScanResultModel.aggregate<{
        totalScans: number;
        highRisk: number;
        mediumRisk: number;
        lowRisk: number;
      }>([
        {
          $group: {
            _id: null,
            totalScans: { $sum: 1 },
            highRisk: { $sum: { $cond: [{ $eq: ['$riskClassification', 'High Risk'] }, 1, 0] } },
            mediumRisk: { $sum: { $cond: [{ $eq: ['$riskClassification', 'Medium Risk'] }, 1, 0] } },
            lowRisk: { $sum: { $cond: [{ $eq: ['$riskClassification', 'Low Risk'] }, 1, 0] } },
          },
        },
      ]),
      ScanModel.aggregate<{ scanType: string; count: number }>([
        { $group: { _id: '$scanType', count: { $sum: 1 } } },
        { $project: { _id: 0, scanType: '$_id', count: 1 } },
      ]),
      SuspiciousJobReportModel.find().sort({ createdAt: -1 }).limit(50).lean(),
      FeedbackModel.find().sort({ createdAt: -1 }).limit(50).lean(),
      ThreatIntelSourceModel.find().sort({ name: 1 }).lean(),
      SystemErrorModel.find().sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    const profileMap = new Map(profileDocs.map((p) => [p.userId, p.fullName]));
    const countMap = new Map(userScanCounts.map((c) => [c._id, c.count]));

    const users = userDocs.map((u) => ({
      id: u._id,
      email: u.email,
      role: u.role,
      isActive: u.isActive ? 1 : 0,
      createdAt: u.createdAt.toISOString(),
      fullName: profileMap.get(u._id) || 'ScamShield Member',
      scanCount: countMap.get(u._id) || 0,
    }));

    const scanStats = scanStatsAgg[0] || {
      totalScans: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
    };

    const reports = reportDocs.map((r) => ({
      id: r._id,
      jobTitle: r.jobTitle,
      companyName: r.companyName,
      scamType: r.scamType,
      platformSource: r.platformSource,
      status: r.status,
      upvotes: r.upvotes,
      createdAt: r.createdAt.toISOString(),
      description: r.description,
    }));

    const feedbackList = feedbackDocs.map((f) => ({
      id: f._id,
      name: f.name,
      email: f.email,
      subject: f.subject,
      message: f.message,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
    }));

    const threatSources = threatSourceDocs.map((s) => ({
      id: s._id,
      name: s.name,
      providerType: s.providerType,
      endpointUrl: s.endpointUrl,
      envKeyName: s.envKeyName,
      isEnabled: Boolean(s.isEnabled),
      description: s.description,
      updatedAt: s.updatedAt.toISOString(),
      apiKeyConfigured: s.envKeyName ? Boolean(process.env[String(s.envKeyName)]) : true,
    }));

    const systemErrors = systemErrorDocs.map((e) => ({
      id: e._id,
      endpoint: e.endpoint,
      errorMessage: e.errorMessage,
      severity: e.severity,
      createdAt: e.createdAt.toISOString(),
    }));

    res.json({
      users,
      scanStats,
      scansByType: scansByTypeAgg,
      reports,
      feedbackList,
      threatSources,
      systemErrors,
      database: getDatabaseStatus(),
      aiService: {
        provider: 'Google Gemini API (@google/genai)',
        model: getActiveGeminiModel(),
        configured: isAiServiceConfigured(),
        fallbackMode: isAiServiceConfigured()
          ? 'Active with automatic quota fallback'
          : 'Rule-based fallback active (GEMINI_API_KEY missing)',
      },
    });
  } catch (err) {
    logSystemError('/api/admin/overview', err);
    res.status(500).json({ error: 'Unable to load admin telemetry.' });
  }
});

app.patch('/api/admin/reports/:id', requireAdmin, async (req, res) => {
  try {
    const id = sanitizeString(req.params.id, 64);
    const status = sanitizeString(req.body?.status, 20);
    if (!['pending', 'verified', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    await SuspiciousJobReportModel.updateOne({ _id: id }, { $set: { status } });
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/admin/reports/:id', err);
    res.status(500).json({ error: 'Unable to update report status.' });
  }
});

app.patch('/api/admin/threat-sources/:id', requireAdmin, async (req, res) => {
  try {
    const id = sanitizeString(req.params.id, 64);
    const isEnabled = Boolean(req.body?.isEnabled);
    await ThreatIntelSourceModel.updateOne(
      { _id: id },
      { $set: { isEnabled, updatedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/admin/threat-sources/:id', err);
    res.status(500).json({ error: 'Unable to update threat intelligence source.' });
  }
});

app.patch('/api/admin/feedback/:id', requireAdmin, async (req, res) => {
  try {
    const id = sanitizeString(req.params.id, 64);
    const status = sanitizeString(req.body?.status, 20);
    if (!['new', 'reviewed', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'Invalid feedback status.' });
      return;
    }
    await FeedbackModel.updateOne({ _id: id }, { $set: { status } });
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/admin/feedback/:id', err);
    res.status(500).json({ error: 'Unable to update feedback status.' });
  }
});

app.patch('/api/admin/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = sanitizeString(req.params.id, 64);
    const isActive = Boolean(req.body?.isActive);
    if (id === req.user!.userId) {
      res.status(400).json({ error: 'Cannot change active state of your own admin session.' });
      return;
    }
    await UserModel.updateOne({ _id: id }, { $set: { isActive } });
    res.json({ ok: true });
  } catch (err) {
    logSystemError('/api/admin/users/:id/status', err);
    res.status(500).json({ error: 'Unable to update user status.' });
  }
});

// =======================
// VITE / STATIC SERVING
// =======================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API route not found.' });
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind HTTP port immediately so Cloud Run startup health checks succeed without waiting on DB boot
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScamShield MERN server running on http://localhost:${PORT}`);
  });

  // Initialize MongoDB connection & seed data concurrently
  initializeDatabase()
    .then(() => {
      const dbStatus = getDatabaseStatus();
      console.log(`Connected to ${dbStatus.engine}`);
    })
    .catch((err) => {
      console.error('MongoDB initialization error:', err);
    });
}

startServer().catch((err) => {
  console.error('Failed to start ScamShield server:', err);
  process.exit(1);
});
