import { jsPDF } from 'jspdf';
import type {
  JobScanResult,
  EmailScanResult,
  UrlScanResult,
  CompanyVerificationResult,
  ScanType,
} from '../types';
import { apiRequest } from './api';

interface PdfExportPayload {
  scanId: string;
  scanType: ScanType;
  createdAt: string;
  subjectTitle: string;
  companyName?: string;
  result: JobScanResult | EmailScanResult | UrlScanResult | CompanyVerificationResult;
  isAuthenticated?: boolean;
}

export async function generateAndDownloadScanPdf(payload: PdfExportPayload): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxTextWidth = pageWidth - margin * 2;
  let y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 48;
    }
  };

  const addWrappedText = (text: string, fontSize = 10, color: [number, number, number] = [30, 41, 59], lineGap = 14) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxTextWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineGap + 4);
      doc.text(line, margin, y);
      y += lineGap;
    }
  };

  const addSectionHeading = (title: string) => {
    ensureSpace(32);
    y += 10;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
  };

  // Top Header Band
  doc.setFillColor(11, 18, 34);
  doc.rect(0, 0, pageWidth, 88, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('ScamShield Security Assessment Report', margin, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Report ID: ${payload.scanId}`, margin, 58);
  doc.text(
    `Generated: ${new Date(payload.createdAt).toLocaleString()}   |   Scan Type: ${payload.scanType.toUpperCase()}`,
    margin,
    72
  );

  y = 114;

  // Summary Box
  const riskScore = payload.result.riskScore;
  const riskClass = payload.result.riskClassification;
  const badgeColor: [number, number, number] =
    riskClass === 'High Risk' ? [220, 38, 38] : riskClass === 'Medium Risk' ? [217, 119, 6] : [22, 163, 74];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, maxTextWidth, 68, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Subject: ${payload.subjectTitle.slice(0, 75)}`, margin + 14, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Company / Entity: ${(payload.companyName || 'Not specified').slice(0, 70)}`, margin + 14, y + 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...badgeColor);
  doc.text(`Risk Score: ${riskScore}/100 (${riskClass})`, margin + 14, y + 58);

  y += 86;
  doc.setFont('helvetica', 'normal');

  if (payload.scanType === 'job') {
    const r = payload.result as JobScanResult;
    addSectionHeading('AI Assessment Summary');
    addWrappedText(r.finalAssessment);

    addSectionHeading('Detected Warning Signs');
    if (r.detectedWarningSigns.length === 0) {
      addWrappedText('No major risk indicators were identified in the submitted text.');
    } else {
      for (const w of r.detectedWarningSigns) {
        addWrappedText(`• [${w.severity.toUpperCase()}] ${w.category}: ${w.explanation}`);
      }
    }

    if (r.suspiciousPhrases.length > 0) {
      addSectionHeading('Suspicious Phrases Flagged');
      for (const phrase of r.suspiciousPhrases) {
        addWrappedText(`• "${phrase}"`);
      }
    }

    if (r.positiveIndicators.length > 0) {
      addSectionHeading('Positive Indicators');
      for (const pos of r.positiveIndicators) {
        addWrappedText(`• ${pos}`);
      }
    }

    addSectionHeading('Recommended Safety Precautions');
    for (const step of r.recommendedPrecautions) {
      addWrappedText(`• ${step}`);
    }
  } else if (payload.scanType === 'email') {
    const r = payload.result as EmailScanResult;
    addSectionHeading('Email Analysis Explanation');
    addWrappedText(r.explanation);

    addSectionHeading('Detected Warning Signs');
    if (r.warningSigns.length === 0) {
      addWrappedText('No clear phishing or fee-fraud triggers detected.');
    } else {
      for (const w of r.warningSigns) {
        addWrappedText(`• [${w.severity.toUpperCase()}] ${w.indicator}: ${w.explanation}`);
      }
    }

    if (r.suspiciousPhrases.length > 0) {
      addSectionHeading('Suspicious Phrases');
      for (const p of r.suspiciousPhrases) {
        addWrappedText(`• "${p}"`);
      }
    }

    addSectionHeading('Recommended Next Steps');
    for (const s of r.recommendedNextSteps) {
      addWrappedText(`• ${s}`);
    }
  } else if (payload.scanType === 'url') {
    const r = payload.result as UrlScanResult;
    addSectionHeading('URL Inspection Summary');
    addWrappedText(`Inspected URL: ${r.submittedUrl}`);
    addWrappedText(r.explanation);

    addSectionHeading('Detected Indicators');
    if (r.detectedIndicators.length === 0) {
      addWrappedText('No malicious indicators observed in structural or configured threat-feed checks.');
    } else {
      for (const ind of r.detectedIndicators) {
        addWrappedText(`• [${ind.severity.toUpperCase()}] ${ind.indicator}: ${ind.detail}`);
      }
    }

    addSectionHeading('Recommended Precautions');
    for (const p of r.recommendedPrecautions) {
      addWrappedText(`• ${p}`);
    }
  } else if (payload.scanType === 'company') {
    const r = payload.result as CompanyVerificationResult;
    addSectionHeading('Overall Verification Assessment');
    addWrappedText(r.overallAssessment);

    const sections: Array<[string, string[]]> = [
      ['Evidence Found', r.evidenceFound],
      ['Information That Matches', r.informationMatches],
      ['Information That Does Not Match', r.informationDoesNotMatch],
      ['Information That Could Not Be Verified', r.couldNotVerify],
      ['Recommended Verification Steps', r.recommendedSteps],
    ];
    for (const [title, items] of sections) {
      if (items.length > 0) {
        addSectionHeading(title);
        for (const item of items) {
          addWrappedText(`• ${item}`);
        }
      }
    }
  }

  addSectionHeading('Important Disclaimer');
  addWrappedText(
    payload.result.disclaimer ||
      'ScamShield provides AI-assisted risk assessments based on submitted information and available evidence. Results are informational and cannot guarantee that a job, company or website is legitimate or fraudulent. Users should independently verify employers through official channels.',
    9,
    [100, 116, 139],
    13
  );

  const safeSlug = payload.subjectTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 36) || 'report';
  doc.save(`scamshield-${payload.scanType}-${safeSlug}.pdf`);

  if (payload.isAuthenticated) {
    apiRequest('/api/notifications/report-generated', {
      method: 'POST',
      body: JSON.stringify({ subject: payload.subjectTitle, scanId: payload.scanId }),
    }).catch(() => {});
  }
}
