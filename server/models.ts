import crypto from 'crypto';
import mongoose, { Schema, type Model } from 'mongoose';

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfile {
  _id: string;
  userId: string;
  fullName: string;
  jobSearchStatus: string;
  notifyHighRisk: boolean;
  notifyReports: boolean;
  emailDigest: boolean;
  updatedAt: Date;
}

export interface IScan {
  _id: string;
  userId: string | null;
  scanType: 'job' | 'email' | 'url' | 'company';
  subjectTitle: string;
  companyName: string;
  inputPayload: Record<string, unknown>;
  createdAt: Date;
}

export interface IScanResult {
  _id: string;
  scanId: string;
  riskScore: number;
  riskClassification: 'Low Risk' | 'Medium Risk' | 'High Risk';
  confidenceLevel: string;
  analysisSource: string;
  structuredResult: Record<string, unknown>;
  summary: string;
  createdAt: Date;
}

export interface IScanHistory {
  _id: string;
  userId: string;
  scanId: string;
  scanType: 'job' | 'email' | 'url' | 'company';
  jobOrCompanyName: string;
  riskScore: number;
  riskClassification: 'Low Risk' | 'Medium Risk' | 'High Risk';
  analysisSummary: string;
  createdAt: Date;
}

export interface INotification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  category: 'info' | 'warning' | 'success' | 'security';
  isRead: boolean;
  relatedScanId: string | null;
  createdAt: Date;
}

export interface IFeedback {
  _id: string;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'reviewed' | 'resolved';
  createdAt: Date;
}

export interface ISuspiciousJobReport {
  _id: string;
  userId: string | null;
  jobTitle: string;
  companyName: string;
  scamType: string;
  platformSource: string;
  contactUsed: string;
  description: string;
  evidenceUrl: string;
  status: 'pending' | 'verified' | 'dismissed';
  upvotes: number;
  createdAt: Date;
}

export interface IPasswordResetToken {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface IEmailVerificationOtp {
  _id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  used: boolean;
  createdAt: Date;
}

export interface IThreatIntelSource {
  _id: string;
  name: string;
  providerType: string;
  endpointUrl: string | null;
  envKeyName: string | null;
  isEnabled: boolean;
  description: string;
  updatedAt: Date;
}

export interface ISystemError {
  _id: string;
  endpoint: string;
  errorMessage: string;
  severity: string;
  createdAt: Date;
}

const uuidDefault = () => crypto.randomUUID();

const userSchema = new Schema<IUser>(
  {
    _id: { type: String, default: uuidDefault },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    isActive: { type: Boolean, default: true, required: true },
    emailVerified: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, versionKey: false }
);

const profileSchema = new Schema<IProfile>(
  {
    _id: { type: String, default: uuidDefault },
    userId: { type: String, required: true, unique: true, ref: 'User' },
    fullName: { type: String, required: true, trim: true },
    jobSearchStatus: { type: String, default: 'Actively Applying', required: true },
    notifyHighRisk: { type: Boolean, default: true, required: true },
    notifyReports: { type: Boolean, default: true, required: true },
    emailDigest: { type: Boolean, default: false, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const scanSchema = new Schema<IScan>(
  {
    _id: { type: String, default: uuidDefault },
    userId: { type: String, default: null, index: true, ref: 'User' },
    scanType: { type: String, enum: ['job', 'email', 'url', 'company'], required: true },
    subjectTitle: { type: String, required: true },
    companyName: { type: String, default: '' },
    inputPayload: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
scanSchema.index({ userId: 1, createdAt: -1 });

const scanResultSchema = new Schema<IScanResult>(
  {
    _id: { type: String, default: uuidDefault },
    scanId: { type: String, required: true, unique: true, ref: 'Scan' },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    riskClassification: {
      type: String,
      enum: ['Low Risk', 'Medium Risk', 'High Risk'],
      required: true,
    },
    confidenceLevel: { type: String, default: 'Medium', required: true },
    analysisSource: { type: String, default: 'gemini_ai', required: true },
    structuredResult: { type: Schema.Types.Mixed, required: true },
    summary: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const scanHistorySchema = new Schema<IScanHistory>(
  {
    _id: { type: String, default: uuidDefault },
    userId: { type: String, required: true, ref: 'User' },
    scanId: { type: String, required: true, unique: true, ref: 'Scan' },
    scanType: { type: String, enum: ['job', 'email', 'url', 'company'], required: true },
    jobOrCompanyName: { type: String, required: true },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    riskClassification: {
      type: String,
      enum: ['Low Risk', 'Medium Risk', 'High Risk'],
      required: true,
    },
    analysisSummary: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
scanHistorySchema.index({ userId: 1, createdAt: -1 });
scanHistorySchema.index({ userId: 1, scanType: 1, riskClassification: 1 });

const notificationSchema = new Schema<INotification>(
  {
    _id: { type: String, default: uuidDefault },
    userId: { type: String, required: true, ref: 'User' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    category: {
      type: String,
      enum: ['info', 'warning', 'success', 'security'],
      default: 'info',
      required: true,
    },
    isRead: { type: Boolean, default: false, required: true },
    relatedScanId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const feedbackSchema = new Schema<IFeedback>(
  {
    _id: { type: String, default: uuidDefault },
    userId: { type: String, default: null, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'reviewed', 'resolved'], default: 'new', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
feedbackSchema.index({ createdAt: -1 });

const suspiciousJobReportSchema = new Schema<ISuspiciousJobReport>(
  {
    _id: { type: String, default: uuidDefault },
    userId: { type: String, default: null, ref: 'User' },
    jobTitle: { type: String, required: true },
    companyName: { type: String, required: true },
    scamType: { type: String, required: true },
    platformSource: { type: String, required: true },
    contactUsed: { type: String, default: '' },
    description: { type: String, required: true },
    evidenceUrl: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'verified', 'dismissed'], default: 'pending', required: true },
    upvotes: { type: Number, default: 1, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
suspiciousJobReportSchema.index({ status: 1, upvotes: -1, createdAt: -1 });

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    _id: { type: String, default: uuidDefault },
    userId: { type: String, required: true, ref: 'User', index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const emailVerificationOtpSchema = new Schema<IEmailVerificationOtp>(
  {
    _id: { type: String, default: uuidDefault },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, required: true },
    used: { type: Boolean, default: false, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
emailVerificationOtpSchema.index({ email: 1, used: 1, createdAt: -1 });

const threatIntelSourceSchema = new Schema<IThreatIntelSource>(
  {
    _id: { type: String, default: uuidDefault },
    name: { type: String, required: true, unique: true },
    providerType: { type: String, required: true },
    endpointUrl: { type: String, default: null },
    envKeyName: { type: String, default: null },
    isEnabled: { type: Boolean, default: true, required: true },
    description: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const systemErrorSchema = new Schema<ISystemError>(
  {
    _id: { type: String, default: uuidDefault },
    endpoint: { type: String, required: true },
    errorMessage: { type: String, required: true },
    severity: { type: String, default: 'error', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
systemErrorSchema.index({ createdAt: -1 });

export const UserModel = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', userSchema);
export const ProfileModel =
  (mongoose.models.Profile as Model<IProfile>) || mongoose.model<IProfile>('Profile', profileSchema);
export const ScanModel = (mongoose.models.Scan as Model<IScan>) || mongoose.model<IScan>('Scan', scanSchema);
export const ScanResultModel =
  (mongoose.models.ScanResult as Model<IScanResult>) || mongoose.model<IScanResult>('ScanResult', scanResultSchema);
export const ScanHistoryModel =
  (mongoose.models.ScanHistory as Model<IScanHistory>) ||
  mongoose.model<IScanHistory>('ScanHistory', scanHistorySchema);
export const NotificationModel =
  (mongoose.models.Notification as Model<INotification>) ||
  mongoose.model<INotification>('Notification', notificationSchema);
export const FeedbackModel =
  (mongoose.models.Feedback as Model<IFeedback>) || mongoose.model<IFeedback>('Feedback', feedbackSchema);
export const SuspiciousJobReportModel =
  (mongoose.models.SuspiciousJobReport as Model<ISuspiciousJobReport>) ||
  mongoose.model<ISuspiciousJobReport>('SuspiciousJobReport', suspiciousJobReportSchema);
export const PasswordResetTokenModel =
  (mongoose.models.PasswordResetToken as Model<IPasswordResetToken>) ||
  mongoose.model<IPasswordResetToken>('PasswordResetToken', passwordResetTokenSchema);
export const EmailVerificationOtpModel =
  (mongoose.models.EmailVerificationOtp as Model<IEmailVerificationOtp>) ||
  mongoose.model<IEmailVerificationOtp>('EmailVerificationOtp', emailVerificationOtpSchema);
export const ThreatIntelSourceModel =
  (mongoose.models.ThreatIntelSource as Model<IThreatIntelSource>) ||
  mongoose.model<IThreatIntelSource>('ThreatIntelSource', threatIntelSourceSchema);
export const SystemErrorModel =
  (mongoose.models.SystemError as Model<ISystemError>) ||
  mongoose.model<ISystemError>('SystemError', systemErrorSchema);
