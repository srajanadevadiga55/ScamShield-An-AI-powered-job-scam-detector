export type RiskClassification = 'Low Risk' | 'Medium Risk' | 'High Risk';
export type ScanType = 'job' | 'email' | 'url' | 'company';

export interface UserPreferences {
  notifyHighRisk: boolean;
  notifyReports: boolean;
  emailDigest: boolean;
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  fullName: string;
  jobSearchStatus: string;
  emailVerified?: boolean;
  createdAt?: string;
  unreadNotifications?: number;
  preferences?: UserPreferences;
}

export interface JobScanResult {
  jobTitle: string;
  companyName: string;
  riskScore: number;
  riskClassification: RiskClassification;
  confidenceLevel: 'Low' | 'Medium' | 'High';
  analysisSource: 'gemini_ai' | 'rule_based_fallback';
  detectedWarningSigns: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high';
    explanation: string;
  }>;
  suspiciousPhrases: string[];
  positiveIndicators: string[];
  recommendedPrecautions: string[];
  finalAssessment: string;
  disclaimer: string;
}

export interface EmailScanResult {
  subjectOrSender: string;
  riskScore: number;
  riskClassification: RiskClassification;
  confidenceLevel: 'Low' | 'Medium' | 'High';
  analysisSource: 'gemini_ai' | 'rule_based_fallback';
  suspiciousPhrases: string[];
  warningSigns: Array<{
    indicator: string;
    severity: 'low' | 'medium' | 'high';
    explanation: string;
  }>;
  explanation: string;
  recommendedNextSteps: string[];
  disclaimer: string;
}

export interface UrlScanResult {
  submittedUrl: string;
  riskScore: number;
  riskClassification: RiskClassification;
  confidenceLevel: 'Low' | 'Medium' | 'High';
  analysisSource: 'gemini_ai' | 'rule_based_fallback';
  detectedIndicators: Array<{
    indicator: string;
    severity: 'low' | 'medium' | 'high';
    detail: string;
  }>;
  explanation: string;
  recommendedPrecautions: string[];
  networkEvidence: {
    normalizedUrl: string;
    hostname: string;
    protocol: string;
    usesHttps: boolean;
    isSafeToFetch: boolean;
    blockReason?: string;
    structuralSignals: string[];
    resolvedIps: string[];
    redirectChain: string[];
    finalUrl: string;
    httpStatus: number | null;
    threatIntelChecks: Array<{
      source: string;
      checked: boolean;
      status: 'clean' | 'flagged' | 'unconfigured' | 'unavailable';
      detail: string;
    }>;
  };
  disclaimer: string;
}

export interface CompanyVerificationResult {
  companyName: string;
  riskScore: number;
  riskClassification: RiskClassification;
  overallAssessment: string;
  analysisSource: 'gemini_ai' | 'rule_based_fallback';
  evidenceFound: string[];
  informationMatches: string[];
  informationDoesNotMatch: string[];
  couldNotVerify: string[];
  recommendedSteps: string[];
  domainEvidence: {
    websiteNormalized: string | null;
    websiteHostname: string | null;
    emailDomain: string | null;
    isFreeEmailProvider: boolean;
    domainsMatch: boolean | null;
    dnsResolved: boolean;
    mxRecordsFound: boolean;
    mxHosts: string[];
    websiteReachable: boolean | null;
    httpStatus: number | null;
    usesHttps: boolean | null;
    rdapChecked: boolean;
    rdapRegistrar: string | null;
    rdapRegistrationDate: string | null;
  };
  disclaimer: string;
}

export interface ScanRecordResponse<T = unknown> {
  scanId: string;
  scanType?: ScanType;
  subjectTitle?: string;
  companyName?: string;
  savedToHistory?: boolean;
  createdAt: string;
  inputPayload?: Record<string, unknown>;
  result: T;
}

export interface ScanHistoryItem {
  id: string;
  scanId: string;
  scanType: ScanType;
  jobOrCompanyName: string;
  riskScore: number;
  riskClassification: RiskClassification;
  analysisSummary: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'info' | 'warning' | 'success' | 'security';
  isRead: number;
  relatedScanId: string | null;
  createdAt: string;
}

export interface CommunityReport {
  id: string;
  jobTitle: string;
  companyName: string;
  scamType: string;
  platformSource: string;
  contactUsed: string;
  description: string;
  evidenceUrl: string;
  status: 'pending' | 'verified' | 'dismissed';
  upvotes: number;
  createdAt: string;
}
