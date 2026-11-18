import dns from 'dns/promises';
import net from 'net';
import { ThreatIntelSourceModel } from './models.ts';

export interface SafeUrlInspection {
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
  responseContentType: string | null;
  threatIntelChecks: Array<{
    source: string;
    checked: boolean;
    status: 'clean' | 'flagged' | 'unconfigured' | 'unavailable';
    detail: string;
  }>;
}

export interface CompanyDomainEvidence {
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
  rdapStatus: string[];
}

const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
]);

const URL_SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
]);

const SUSPICIOUS_TLDS = new Set([
  'xyz',
  'top',
  'click',
  'gq',
  'tk',
  'ml',
  'cf',
  'ga',
  'work',
  'buzz',
  'icu',
  'loan',
  'cam',
]);

const TARGETED_BRANDS = [
  'google',
  'microsoft',
  'amazon',
  'apple',
  'meta',
  'netflix',
  'linkedin',
  'indeed',
  'glassdoor',
  'workday',
  'greenhouse',
  'lever',
  'deloitte',
  'accenture',
  'infosys',
  'tcs',
  'wipro',
  'ibm',
  'oracle',
  'cisco',
  'jpmorgan',
  'goldmansachs',
];

export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 192 && b === 0 && parts[2] === 0) return true;
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:')) {
      const mappedV4 = lower.replace('::ffff:', '');
      if (net.isIPv4(mappedV4)) return isPrivateOrReservedIp(mappedV4);
    }
    return false;
  }

  return true;
}

export async function validateSafePublicUrl(rawUrl: string): Promise<{
  ok: boolean;
  url?: URL;
  ips: string[];
  reason?: string;
}> {
  let candidate = rawUrl.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, ips: [], reason: 'Invalid URL syntax.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, ips: [], reason: 'Only HTTP and HTTPS protocols are allowed.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return { ok: false, ips: [], reason: 'Localhost and internal hostnames are blocked for security.' };
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      return { ok: false, ips: [host], reason: 'Private, loopback, or reserved IP addresses are blocked.' };
    }
    return { ok: true, url: parsed, ips: [host] };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    const ips = records.map((r) => r.address);
    if (ips.length === 0) {
      return { ok: false, ips: [], reason: 'Domain did not resolve to any public IP address.' };
    }
    for (const ip of ips) {
      if (isPrivateOrReservedIp(ip)) {
        return {
          ok: false,
          ips,
          reason: 'Domain resolved to a private or reserved internal IP address.',
        };
      }
    }
    return { ok: true, url: parsed, ips };
  } catch {
    return { ok: false, ips: [], reason: 'Hostname could not be resolved via DNS.' };
  }
}

function analyzeUrlStructure(parsed: URL): string[] {
  const signals: string[] = [];
  const host = parsed.hostname.toLowerCase();
  const labels = host.split('.');
  const tld = labels[labels.length - 1] || '';

  if (parsed.protocol !== 'https:') {
    signals.push('URL uses unencrypted HTTP instead of HTTPS.');
  }
  if (net.isIP(host)) {
    signals.push('URL points directly to a raw IP address rather than a registered domain name.');
  }
  if (parsed.username || parsed.password || parsed.href.includes('@')) {
    signals.push('URL contains embedded credentials or an "@" character, a common phishing obfuscation pattern.');
  }
  if (host.includes('xn--')) {
    signals.push('Domain uses Punycode (xn--), which can be used for IDN homograph lookalike attacks.');
  }
  if (labels.length >= 4) {
    signals.push(`Hostname has ${labels.length} domain levels (excessive subdomains can mask the real root domain).`);
  }
  if (URL_SHORTENERS.has(host)) {
    signals.push(`URL uses a link shortener (${host}), hiding the final destination.`);
  }
  if (SUSPICIOUS_TLDS.has(tld)) {
    signals.push(`Top-level domain ".${tld}" is frequently abused in disposable phishing campaigns.`);
  }
  if (parsed.pathname.length > 90 || parsed.search.length > 150) {
    signals.push('Unusually long URL path or query parameters.');
  }

  // Lookalike brand detection (e.g., microsoft-careers-apply.xyz or goog1e-jobs.com)
  const domainWithoutTld = labels.slice(0, -1).join('.');
  for (const brand of TARGETED_BRANDS) {
    if (
      domainWithoutTld.includes(brand) &&
      host !== `${brand}.com` &&
      !host.endsWith(`.${brand}.com`) &&
      !host.endsWith(`.${brand}.org`)
    ) {
      signals.push(
        `Domain includes the well-known brand name "${brand}" on an unrelated domain (${host}), which requires verification.`
      );
      break;
    }
  }

  if (/(verify|login|signin|update|secure|onboarding|offer-letter|kyc|wallet)/i.test(parsed.pathname + parsed.search)) {
    signals.push('URL path contains sensitive action keywords (e.g., verify, login, onboarding, kyc).');
  }

  return signals;
}

export async function inspectUrlSafely(rawUrl: string): Promise<SafeUrlInspection> {
  const validation = await validateSafePublicUrl(rawUrl);

  let parsedFallback: URL | null = null;
  try {
    const withProto = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    parsedFallback = new URL(withProto);
  } catch {
    parsedFallback = null;
  }

  const normalizedUrl = validation.url?.toString() || parsedFallback?.toString() || rawUrl.trim();
  const hostname = validation.url?.hostname || parsedFallback?.hostname || '';
  const protocol = validation.url?.protocol || parsedFallback?.protocol || '';
  const usesHttps = protocol === 'https:';
  const structuralSignals = validation.url
    ? analyzeUrlStructure(validation.url)
    : parsedFallback
      ? analyzeUrlStructure(parsedFallback)
      : ['Submitted text is not a valid HTTP/HTTPS URL.'];

  const redirectChain: string[] = [];
  let finalUrl = normalizedUrl;
  let httpStatus: number | null = null;
  let responseContentType: string | null = null;

  if (validation.ok && validation.url) {
    let currentUrl = validation.url.toString();
    redirectChain.push(currentUrl);

    for (let hop = 0; hop < 3; hop++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': 'ScamShield-URL-Verifier/1.0' },
        });
        clearTimeout(timeout);

        httpStatus = resp.status;
        responseContentType = resp.headers.get('content-type');

        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get('location');
          if (!location) break;
          const resolvedNext = new URL(location, currentUrl).toString();
          const nextValidation = await validateSafePublicUrl(resolvedNext);
          if (!nextValidation.ok) {
            structuralSignals.push(`Redirect target blocked for safety: ${nextValidation.reason}`);
            break;
          }
          redirectChain.push(resolvedNext);
          currentUrl = resolvedNext;
          finalUrl = resolvedNext;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    if (redirectChain.length > 1) {
      structuralSignals.push(`URL redirected ${redirectChain.length - 1} time(s) to ${finalUrl}.`);
    }
  }

  // Threat intelligence checks using configured sources
  const threatIntelChecks: SafeUrlInspection['threatIntelChecks'] = [];
  const enabledSources = await ThreatIntelSourceModel.find({ isEnabled: true })
    .select('name envKeyName isEnabled')
    .lean();

  const isRealKey = (val?: string) => {
    const trimmed = val?.trim() || '';
    return trimmed.length >= 10 && !/^(none|null|skip|optional|na|n\/a|disabled)$/i.test(trimmed);
  };

  for (const src of enabledSources) {
    if (src.name.includes('Google Safe Browsing')) {
      const rawKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
      const apiKey = isRealKey(rawKey) ? rawKey!.trim() : '';
      if (!apiKey) {
        threatIntelChecks.push({
          source: src.name,
          checked: false,
          status: 'unconfigured',
          detail: 'API key not configured in environment.',
        });
      } else if (validation.ok) {
        try {
          const resp = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client: { clientId: 'scamshield', clientVersion: '1.0.0' },
                threatInfo: {
                  threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                  platformTypes: ['ANY_PLATFORM'],
                  threatEntryTypes: ['URL'],
                  threatEntries: [{ url: normalizedUrl }],
                },
              }),
            }
          );
          if (resp.ok) {
            const data = (await resp.json()) as { matches?: unknown[] };
            const flagged = Array.isArray(data.matches) && data.matches.length > 0;
            threatIntelChecks.push({
              source: src.name,
              checked: true,
              status: flagged ? 'flagged' : 'clean',
              detail: flagged
                ? 'URL matched Google Safe Browsing threat lists.'
                : 'No active threat matches found in Google Safe Browsing.',
            });
          } else {
            threatIntelChecks.push({
              source: src.name,
              checked: false,
              status: 'unavailable',
              detail: `Safe Browsing API returned status ${resp.status}.`,
            });
          }
        } catch {
          threatIntelChecks.push({
            source: src.name,
            checked: false,
            status: 'unavailable',
            detail: 'Could not reach Google Safe Browsing API.',
          });
        }
      }
    } else if (src.name.includes('VirusTotal')) {
      const rawVtKey = process.env.VIRUSTOTAL_API_KEY;
      const vtKey = isRealKey(rawVtKey) ? rawVtKey!.trim() : '';
      if (!vtKey) {
        threatIntelChecks.push({
          source: src.name,
          checked: false,
          status: 'unconfigured',
          detail: 'API key not configured in environment.',
        });
      } else if (validation.ok && hostname) {
        try {
          const resp = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(hostname)}`, {
            headers: { 'x-apikey': vtKey },
          });
          if (resp.ok) {
            const vtData = (await resp.json()) as {
              data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } };
            };
            const stats = vtData.data?.attributes?.last_analysis_stats;
            const malicious = stats?.malicious || 0;
            const suspicious = stats?.suspicious || 0;
            threatIntelChecks.push({
              source: src.name,
              checked: true,
              status: malicious > 0 || suspicious > 1 ? 'flagged' : 'clean',
              detail: `Domain stats: ${malicious} malicious, ${suspicious} suspicious engine detections.`,
            });
          } else {
            threatIntelChecks.push({
              source: src.name,
              checked: false,
              status: 'unavailable',
              detail: `VirusTotal returned status ${resp.status}.`,
            });
          }
        } catch {
          threatIntelChecks.push({
            source: src.name,
            checked: false,
            status: 'unavailable',
            detail: 'Could not reach VirusTotal API.',
          });
        }
      }
    } else if (src.name.includes('URLhaus') && validation.ok) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const body = new URLSearchParams({ url: normalizedUrl });
        const resp = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
          method: 'POST',
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = (await resp.json()) as { query_status?: string; threat?: string };
          const flagged = data.query_status === 'ok';
          threatIntelChecks.push({
            source: src.name,
            checked: true,
            status: flagged ? 'flagged' : 'clean',
            detail: flagged
              ? `Flagged in URLhaus database (${data.threat || 'malware distribution'}).`
              : 'Not listed in Abuse.ch URLhaus feed.',
          });
        } else {
          threatIntelChecks.push({
            source: src.name,
            checked: false,
            status: 'unavailable',
            detail: `URLhaus API responded with HTTP ${resp.status}.`,
          });
        }
      } catch {
        threatIntelChecks.push({
          source: src.name,
          checked: false,
          status: 'unavailable',
          detail: 'URLhaus lookup timed out or was unreachable.',
        });
      }
    }
  }

  return {
    normalizedUrl,
    hostname,
    protocol,
    usesHttps,
    isSafeToFetch: validation.ok,
    blockReason: validation.ok ? undefined : validation.reason,
    structuralSignals,
    resolvedIps: validation.ips,
    redirectChain,
    finalUrl,
    httpStatus,
    responseContentType,
    threatIntelChecks,
  };
}

export async function gatherCompanyDomainEvidence(
  officialWebsite: string,
  companyEmail: string
): Promise<CompanyDomainEvidence> {
  const emailDomain = companyEmail.includes('@')
    ? companyEmail.split('@')[1].trim().toLowerCase()
    : null;
  const isFreeEmailProvider = emailDomain ? FREE_EMAIL_PROVIDERS.has(emailDomain) : false;

  let websiteNormalized: string | null = null;
  let websiteHostname: string | null = null;
  let dnsResolved = false;
  let mxRecordsFound = false;
  let mxHosts: string[] = [];
  let websiteReachable: boolean | null = null;
  let httpStatus: number | null = null;
  let usesHttps: boolean | null = null;
  let rdapChecked = false;
  let rdapRegistrar: string | null = null;
  let rdapRegistrationDate: string | null = null;
  let rdapStatus: string[] = [];

  if (officialWebsite.trim()) {
    const check = await validateSafePublicUrl(officialWebsite.trim());
    if (check.url) {
      websiteNormalized = check.url.toString();
      websiteHostname = check.url.hostname.toLowerCase().replace(/^www\./, '');
      usesHttps = check.url.protocol === 'https:';
    }
    if (check.ok && check.url) {
      dnsResolved = check.ips.length > 0;
      const targetDomain = check.url.hostname.toLowerCase().replace(/^www\./, '');

      try {
        const mx = await dns.resolveMx(targetDomain);
        mxRecordsFound = mx.length > 0;
        mxHosts = mx.slice(0, 5).map((m) => m.exchange);
      } catch {
        mxRecordsFound = false;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const resp = await fetch(check.url.toString(), {
          method: 'HEAD',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': 'ScamShield-Company-Verifier/1.0' },
        });
        clearTimeout(timeout);
        httpStatus = resp.status;
        websiteReachable = resp.status < 500;
      } catch {
        websiteReachable = false;
      }

      // Public RDAP domain registration check (no fabricated data)
      try {
        const parts = targetDomain.split('.');
        const apexDomain = parts.length >= 2 ? parts.slice(-2).join('.') : targetDomain;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const rdapResp = await fetch(`https://rdap.org/domain/${encodeURIComponent(apexDomain)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/rdap+json' },
        });
        clearTimeout(timeout);
        if (rdapResp.ok) {
          const rdapJson = (await rdapResp.json()) as {
            events?: Array<{ eventAction?: string; eventDate?: string }>;
            status?: string[];
            entities?: Array<{ roles?: string[]; vcardArray?: unknown[] }>;
          };
          rdapChecked = true;
          const regEvent = rdapJson.events?.find((e) => e.eventAction === 'registration');
          if (regEvent?.eventDate) rdapRegistrationDate = regEvent.eventDate;
          if (Array.isArray(rdapJson.status)) rdapStatus = rdapJson.status.slice(0, 4);
          const registrarEntity = rdapJson.entities?.find((e) => e.roles?.includes('registrar'));
          if (registrarEntity && Array.isArray(registrarEntity.vcardArray?.[1])) {
            const fnField = (registrarEntity.vcardArray[1] as Array<unknown>).find(
              (item) => Array.isArray(item) && item[0] === 'fn'
            ) as Array<unknown> | undefined;
            if (fnField && typeof fnField[3] === 'string') {
              rdapRegistrar = fnField[3];
            }
          }
        }
      } catch {
        rdapChecked = false;
      }
    }
  } else if (emailDomain && !isFreeEmailProvider) {
    try {
      const mx = await dns.resolveMx(emailDomain);
      mxRecordsFound = mx.length > 0;
      mxHosts = mx.slice(0, 5).map((m) => m.exchange);
      dnsResolved = true;
    } catch {
      mxRecordsFound = false;
    }
  }

  let domainsMatch: boolean | null = null;
  if (websiteHostname && emailDomain) {
    domainsMatch = emailDomain === websiteHostname || emailDomain.endsWith(`.${websiteHostname}`);
  }

  return {
    websiteNormalized,
    websiteHostname,
    emailDomain,
    isFreeEmailProvider,
    domainsMatch,
    dnsResolved,
    mxRecordsFound,
    mxHosts,
    websiteReachable,
    httpStatus,
    usesHttps,
    rdapChecked,
    rdapRegistrar,
    rdapRegistrationDate,
    rdapStatus,
  };
}
