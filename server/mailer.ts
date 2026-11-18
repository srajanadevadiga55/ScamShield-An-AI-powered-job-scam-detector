import nodemailer from 'nodemailer';

const cleanEnv = (val?: string) => (val?.trim() || '').replace(/^["']|["']$/g, '').trim();

const isRealValue = (val?: string) => {
  const cleaned = cleanEnv(val);
  return (
    cleaned.length > 0 &&
    !/^(none|null|skip|optional|na|n\/a|disabled|change_me.*|your.*|my_.*)$/i.test(cleaned)
  );
};

function getSmtpConfig() {
  const user = isRealValue(process.env.SMTP_USER) ? cleanEnv(process.env.SMTP_USER) : '';
  const rawPass = isRealValue(process.env.SMTP_PASS) ? cleanEnv(process.env.SMTP_PASS) : '';
  const inferredHost = /@(gmail|googlemail)\.com$/i.test(user) ? 'smtp.gmail.com' : '';
  const host = (isRealValue(process.env.SMTP_HOST) ? cleanEnv(process.env.SMTP_HOST) : '') || inferredHost;
  // Gmail App Passwords are displayed in 4-char groups separated by spaces; strip spaces cleanly for smtp.gmail.com
  const pass = host === 'smtp.gmail.com' ? rawPass.replace(/\s+/g, '') : rawPass;
  const port = Number(cleanEnv(process.env.SMTP_PORT) || 465);
  const from =
    (isRealValue(process.env.SMTP_FROM) ? cleanEnv(process.env.SMTP_FROM) : '') ||
    (user ? `"ScamShield Security" <${user}>` : '');

  return { host, port, user, pass, from };
}

export function isEmailDeliveryConfigured(): boolean {
  const smtp = getSmtpConfig();
  return Boolean(smtp.host && smtp.user && smtp.pass && smtp.from);
}

export function formatMailErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('535') || msg.includes('BadCredentials') || msg.includes('EAUTH')) {
    return 'Gmail rejected the SMTP login (535 Username and Password not accepted). Make sure SMTP_USER is your full Gmail address and SMTP_PASS is a 16-character Google App Password (from myaccount.google.com/apppasswords with 2-Step Verification turned ON), not your regular Gmail login password.';
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    return 'Could not connect to the SMTP mail server. Verify SMTP_HOST and SMTP_PORT (use smtp.gmail.com and port 465 for Gmail).';
  }
  return 'Could not deliver the OTP email. Please check your SMTP_USER and SMTP_PASS settings.';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ sent: boolean; provider?: string }> {
  if (!isEmailDeliveryConfigured()) {
    return { sent: false };
  }

  const smtp = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: smtp.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  return { sent: true, provider: smtp.host };
}

export async function sendVerificationOtpEmail(params: {
  to: string;
  fullName: string;
  otp: string;
  expiresInMinutes: number;
}): Promise<{ sent: boolean; provider?: string }> {
  const safeName = escapeHtml(params.fullName || 'there');
  const safeOtp = escapeHtml(params.otp);

  return sendEmail({
    to: params.to,
    subject: `${params.otp} is your ScamShield email verification OTP`,
    text: [
      `Hello ${params.fullName || 'there'},`,
      '',
      `Your 6-digit ScamShield email verification OTP is: ${params.otp}`,
      '',
      `This code expires in ${params.expiresInMinutes} minutes. Do not share this code with anyone.`,
      '',
      'If you did not request to create a ScamShield account, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #0b1222; color: #e2e8f0; border-radius: 12px; border: 1px solid #1e293b;">
        <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px;">Verify your ScamShield email</h2>
        <p style="margin: 0 0 16px; color: #cbd5e1; font-size: 14px; line-height: 1.5;">
          Hello ${safeName},<br />
          Enter the 6-digit verification code below to finish creating your ScamShield account:
        </p>
        <div style="margin: 20px 0; padding: 16px; background: #070c18; border: 1px solid #334155; border-radius: 8px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #60a5fa; font-family: monospace;">
          ${safeOtp}
        </div>
        <p style="margin: 0 0 8px; color: #94a3b8; font-size: 13px;">
          This OTP expires in ${params.expiresInMinutes} minutes. Never share it with anyone.
        </p>
        <p style="margin: 0; color: #64748b; font-size: 12px;">
          If you did not request this verification, you can safely ignore this message.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  code: string;
  expiresInMinutes: number;
}): Promise<{ sent: boolean; provider?: string }> {
  const safeCode = escapeHtml(params.code);

  return sendEmail({
    to: params.to,
    subject: 'Your ScamShield password reset verification code',
    text: [
      'Your ScamShield password reset verification code is:',
      '',
      params.code,
      '',
      `This code expires in ${params.expiresInMinutes} minutes.`,
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #0b1222; color: #e2e8f0; border-radius: 12px; border: 1px solid #1e293b;">
        <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px;">Password reset request</h2>
        <p style="margin: 0 0 16px; color: #cbd5e1; font-size: 14px; line-height: 1.5;">
          Enter the verification code below to set a new password for your ScamShield account:
        </p>
        <div style="margin: 20px 0; padding: 16px; background: #070c18; border: 1px solid #334155; border-radius: 8px; text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #60a5fa; font-family: monospace;">
          ${safeCode}
        </div>
        <p style="margin: 0; color: #94a3b8; font-size: 13px;">
          This code expires in ${params.expiresInMinutes} minutes.
        </p>
      </div>
    `,
  });
}
