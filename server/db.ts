import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  UserModel,
  ProfileModel,
  ThreatIntelSourceModel,
  SuspiciousJobReportModel,
  SystemErrorModel,
} from './models.ts';

let embeddedServer: MongoMemoryServer | null = null;
let databaseMode = 'MongoDB (Mongoose)';
let initialized = false;
let initPromise: Promise<void> | null = null;

async function connectMongo(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  const rawUri = process.env.MONGODB_URI?.trim() || '';
  const externalUri = /^mongodb(\+srv)?:\/\//i.test(rawUri) ? rawUri : '';
  if (externalUri) {
    databaseMode = 'External MongoDB (Mongoose)';
    await mongoose.connect(externalUri, {
      dbName: process.env.MONGODB_DB_NAME || 'scamshield',
      serverSelectionTimeoutMS: 10000,
    });
    return;
  }

  // Use /tmp in production containers (Cloud Run) where workspace directory may be read-only
  const dbPath =
    process.env.NODE_ENV === 'production'
      ? path.join(os.tmpdir(), 'scamshield-mongodb')
      : path.resolve(process.cwd(), 'data/mongodb');
  fs.mkdirSync(dbPath, { recursive: true });

  // Clean stale lock file left behind by abrupt container restarts if any
  const lockFile = path.join(dbPath, 'mongod.lock');
  if (fs.existsSync(lockFile)) {
    try {
      const content = fs.readFileSync(lockFile, 'utf8').trim();
      if (!content) {
        fs.unlinkSync(lockFile);
      }
    } catch {
      // Ignore lock cleanup errors
    }
  }

  try {
    embeddedServer = await MongoMemoryServer.create({
      instance: {
        dbPath,
        dbName: 'scamshield',
        storageEngine: 'wiredTiger',
        ip: '127.0.0.1',
      },
    });
    databaseMode = 'Embedded MongoDB (WiredTiger / Mongoose)';
  } catch {
    // Fallback to pure in-memory MongoDB instance if disk path is unavailable/locked
    embeddedServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'scamshield',
        ip: '127.0.0.1',
      },
    });
    databaseMode = 'Embedded MongoDB (In-Memory / Mongoose)';
  }

  const uri = embeddedServer.getUri('scamshield');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const shutdown = async () => {
    try {
      await mongoose.disconnect();
      if (embeddedServer) {
        await embeddedServer.stop();
        embeddedServer = null;
      }
    } catch {
      // Ignore cleanup errors on exit
    }
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
}

export async function initializeDatabase(): Promise<void> {
  if (initialized && mongoose.connection.readyState === 1) return;
  if (!initPromise) {
    initPromise = (async () => {
      await connectMongo();
      await seedInitialConfiguration();
      initialized = true;
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

async function seedInitialConfiguration(): Promise<void> {
  // Seed default administrator if none exists
  const adminEmail = 'admin@scamshield.sec';
  const existingAdmin = await UserModel.findOne({ email: adminEmail }).lean();
  if (!existingAdmin) {
    const adminId = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync('ScamShieldAdmin!2026', 10);
    await UserModel.create({
      _id: adminId,
      email: adminEmail,
      passwordHash,
      role: 'admin',
      isActive: true,
    });
    await ProfileModel.create({
      _id: crypto.randomUUID(),
      userId: adminId,
      fullName: 'Security Operations Admin',
      jobSearchStatus: 'Platform Administrator',
    });
  }

  // Seed demo standard user account if none exists
  const demoEmail = 'demo@scamshield.sec';
  const existingDemo = await UserModel.findOne({ email: demoEmail }).lean();
  if (!existingDemo) {
    const demoId = crypto.randomUUID();
    const demoHash = bcrypt.hashSync('ScamShieldUser!2026', 10);
    await UserModel.create({
      _id: demoId,
      email: demoEmail,
      passwordHash: demoHash,
      role: 'user',
      isActive: true,
    });
    await ProfileModel.create({
      _id: crypto.randomUUID(),
      userId: demoId,
      fullName: 'Alex Morgan',
      jobSearchStatus: 'Actively Applying',
    });
  }

  // Seed default threat intelligence sources configuration
  const sourceCount = await ThreatIntelSourceModel.countDocuments();
  if (sourceCount === 0) {
    await ThreatIntelSourceModel.insertMany([
      {
        _id: crypto.randomUUID(),
        name: 'DNS & RDAP Domain Intelligence',
        providerType: 'Built-in Network Resolver',
        endpointUrl: 'https://rdap.org/domain/',
        envKeyName: null,
        isEnabled: true,
        description:
          'Resolves DNS A/AAAA/MX records and queries public RDAP registration metadata without third-party API keys.',
      },
      {
        _id: crypto.randomUUID(),
        name: 'Google Safe Browsing Lookup',
        providerType: 'Threat Feed API',
        endpointUrl: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
        envKeyName: 'GOOGLE_SAFE_BROWSING_API_KEY',
        isEnabled: true,
        description:
          'Checks submitted job application URLs against Google Safe Browsing threat lists when configured.',
      },
      {
        _id: crypto.randomUUID(),
        name: 'VirusTotal URL & Domain Reputation',
        providerType: 'Threat Feed API',
        endpointUrl: 'https://www.virustotal.com/api/v3/urls',
        envKeyName: 'VIRUSTOTAL_API_KEY',
        isEnabled: true,
        description:
          'Queries multi-engine URL reputation statistics via VirusTotal API v3 when configured.',
      },
      {
        _id: crypto.randomUUID(),
        name: 'URLhaus Abuse.ch Feed',
        providerType: 'Threat Feed API',
        endpointUrl: 'https://urlhaus-api.abuse.ch/v1/url/',
        envKeyName: null,
        isEnabled: true,
        description: 'Checks URLs against the public Abuse.ch URLhaus malicious URL database.',
      },
    ]);
  }

  // Seed 3 verified community scam report examples for the Community Scam Reports directory if empty
  const reportCount = await SuspiciousJobReportModel.countDocuments();
  if (reportCount === 0) {
    await SuspiciousJobReportModel.insertMany([
      {
        _id: crypto.randomUUID(),
        userId: null,
        jobTitle: 'Remote Data Entry Specialist — $45/hr Immediate Start',
        companyName: 'Global Apex Logistics (Impersonated)',
        scamType: 'Advance Fee / Equipment Check Scam',
        platformSource: 'Telegram & WhatsApp',
        contactUsed: 'hr-apex-desk@gmail.com',
        description:
          'Recruiter skipped live video interview, conducted text-only chat on Telegram, and asked the candidate to deposit a mobile check to purchase a MacBook from an unverified vendor.',
        evidenceUrl: '',
        status: 'verified',
        upvotes: 19,
      },
      {
        _id: crypto.randomUUID(),
        userId: null,
        jobTitle: 'Junior Cloud Support Trainee (Paid Training Bond)',
        companyName: 'Novatek Career Solutions',
        scamType: 'Registration & Training Fee Fraud',
        platformSource: 'Social Media Ad',
        contactUsed: 'onboarding.novatek@outlook.com',
        description:
          'Required an upfront refundable security deposit of $195 via instant bank transfer before releasing the training portal credentials and offer letter.',
        evidenceUrl: '',
        status: 'verified',
        upvotes: 14,
      },
      {
        _id: crypto.randomUUID(),
        userId: null,
        jobTitle: 'Executive Assistant — Work From Home',
        companyName: 'Vanguard Talent Partners (Lookalike)',
        scamType: 'Phishing & Identity Harvesting',
        platformSource: 'Unsolicited Email',
        contactUsed: 'talent@vanguard-careers-portal.xyz',
        description:
          'Sent a lookalike domain link requesting full SSN, driver license photo, and bank routing details prior to scheduling an initial screening call.',
        evidenceUrl: 'https://vanguard-careers-portal.xyz',
        status: 'verified',
        upvotes: 27,
      },
    ]);
  }
}

export function getDatabaseStatus() {
  return {
    engine: databaseMode,
    connected: mongoose.connection.readyState === 1,
  };
}

export function logSystemError(endpoint: string, error: unknown, severity = 'error'): void {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const msg = error instanceof Error ? error.message : String(error);
    void SystemErrorModel.create({
      _id: crypto.randomUUID(),
      endpoint,
      errorMessage: msg.slice(0, 1000),
      severity,
    }).catch(() => {
      // Ignore logging failure
    });
  } catch {
    // Avoid throwing inside error logger
  }
}
