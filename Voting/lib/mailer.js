/**
 * lib/mailer.js
 * Email sender using Resend HTTP API (port 443 — works on any network).
 * Set RESEND_API_KEY and RESEND_FROM in .env
 * Fallback: set DEV_SKIP_EMAIL=true to print OTP to terminal without sending.
 */
import { Resend } from 'resend';
import { describeVotingHours } from './votingWindow.js';

let _resend = null;
let _resendKey = null;

/** Resend blocks placeholder domains like example.com — see resend.com/docs/dashboard/emails/testing */
const BLOCKED_RECIPIENT_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
]);

function isBlockedTestRecipient(email) {
  const domain = String(email).split('@')[1]?.toLowerCase();
  return BLOCKED_RECIPIENT_DOMAINS.has(domain);
}

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }
  if (_resend && _resendKey === apiKey) return _resend;
  _resendKey = apiKey;
  _resend = new Resend(apiKey);
  return _resend;
}

function getFromAddress() {
  return process.env.RESEND_FROM || 'Block Vote <onboarding@resend.dev>';
}

function resolveRecipient(to) {
  if (isBlockedTestRecipient(to)) {
    const msg = `Invalid recipient ${to}: Resend blocks placeholder domains like example.com. Use a real email or a Resend test address (delivered@resend.dev).`;
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[mailer] ${msg}`);
      return null;
    }
    throw new Error(msg);
  }
  return devRedirectAddress() || to;
}

/** Redirect all mail to one inbox — honoured only outside production. */
function devRedirectAddress() {
  if (process.env.NODE_ENV === 'production') return '';
  return process.env.RESEND_DEV_REDIRECT || '';
}

async function sendEmail({ to, subject, html, text, logLabel = 'email' }) {
  const actualTo = resolveRecipient(to);
  if (!actualTo) return { skipped: true };

  const from = getFromAddress();
  const redirected = Boolean(devRedirectAddress()) && actualTo !== to;
  const actualSubject = redirected ? `[→ ${to}] ${subject}` : subject;

  const { data, error } = await getResendClient().emails.send({
    from,
    to: actualTo,
    subject: actualSubject,
    html,
    text,
  });

  if (error) {
    throw new Error(`${error.message} (from=${from})`);
  }

  if (redirected) {
    console.log(`[mailer] ${logLabel} for ${to} redirected to ${actualTo} (RESEND_DEV_REDIRECT)`);
  }

  return { id: data?.id };
}

export function getTransporter() {
  return getResendClient();
}

/**
 * Send an OTP email to a voter or admin.
 * @param {string} to       - recipient email
 * @param {string} otp      - 6-digit OTP
 * @param {string} purpose  - 'vote' | 'admin-login' | 'admin-signup'
 * @param {string} label    - election or product name for display
 */
export async function sendOTPEmail(to, otp, purpose = 'vote', label = 'Block Vote') {
  const subject = purpose === 'vote'
    ? `Your Voting OTP — ${label}`
    : `Your Login OTP — Block Vote`;

  // Instant bypass for local dev — no network call at all
  if (process.env.NODE_ENV === 'development' && process.env.DEV_SKIP_EMAIL === 'true') {
    console.log(`\n==================================================`);
    console.log(`[DEV MODE] EMAIL OTP FALLBACK (BYPASS ENABLED)`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`OTP: ${otp}`);
    console.log(`==================================================\n`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:linear-gradient(135deg,#0ea5e9,#0369a1);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Block Vote</h1>
                  <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Secure Blockchain Voting</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px;">
                  <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
                    ${purpose === 'vote'
                      ? `You requested to cast your vote in <strong style="color:#e2e8f0;">${label}</strong> via the Block Vote app.`
                      : `You requested to log in to the Block Vote admin site.`
                    }
                    Use the OTP below. It expires in <strong style="color:#e2e8f0;">5 minutes</strong>.
                  </p>
                  <div style="background:#0f172a;border:2px solid #0ea5e9;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Your OTP</p>
                    <p style="margin:0;color:#7dd3fc;font-size:48px;font-weight:900;letter-spacing:10px;">${otp}</p>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:13px;">
                    If you didn't request this, ignore this email. Do not share this OTP with anyone.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#0f172a;padding:20px 36px;border-top:1px solid #1e293b;">
                  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                    Block Vote · Admin on web · Vote on mobile
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    'BLOCK VOTE',
    '',
    'Secure Blockchain Voting',
    '',
    purpose === 'vote'
      ? `You requested to cast your vote in ${label} via the Block Vote app.`
      : 'You requested to log in to the Block Vote admin site.',
    'Use the OTP below. It expires in 5 minutes.',
    '',
    `Your OTP: ${otp}`,
    '',
    "If you didn't request this, ignore this email. Do not share this OTP with anyone.",
  ].join('\n');

  try {
    const result = await sendEmail({ to, subject, html, text, logLabel: 'OTP email' });
    if (result.skipped) return;
  } catch (err) {
    console.error(`[mailer] Failed to send email to ${to}:`, err);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n==================================================`);
      console.log(`[DEV MODE] EMAIL OTP FALLBACK`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`OTP: ${otp}`);
      console.log(`==================================================\n`);
      return;
    }
    throw err;
  }
}


/**
 * Send a vote confirmation receipt.
 *
 * PRIVACY — RECEIPT-FREENESS:
 *   The email intentionally does NOT include the candidate name.
 *   Including it would allow a coercer to demand "show me your email"
 *   and verify the voter's choice, breaking coercion resistance.
 */
export async function sendVoteReceiptEmail(
  to,
  {
    electionTitle = 'Election',
    txHash,
    verifyUrl,
  },
) {
  const subject = `Your Vote Receipt — ${electionTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:linear-gradient(135deg,#10b981,#06b6d4);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Vote Cast Successfully</h1>
                  <p style="margin:8px 0 0;color:#dcfce7;font-size:14px;">Your blockchain receipt is ready</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px;">
                  <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
                    Your vote in <strong style="color:#ffffff;">${electionTitle}</strong> has been
                    securely recorded on the blockchain.
                    For your privacy, the candidate you voted for is not included in this receipt.
                  </p>
                  <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin:0 0 24px;">
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Transaction Hash</p>
                    <p style="margin:0;color:#4ade80;font-size:13px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;word-break:break-all;">${txHash}</p>
                  </div>
                  <div style="text-align:center;margin:0 0 24px;">
                    <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">
                      Verify Your Vote
                    </a>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                    You can use the button above or open this link directly:<br />
                    <a href="${verifyUrl}" style="color:#818cf8;text-decoration:none;word-break:break-all;">${verifyUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#0f172a;padding:20px 36px;border-top:1px solid #1e293b;">
                  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                    Block Vote · Public verification without revealing voter identity
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  if (process.env.NODE_ENV === 'development' && process.env.DEV_SKIP_EMAIL === 'true') {
    console.log(`\n==================================================`);
    console.log(`[DEV MODE] VOTE RECEIPT EMAIL FALLBACK (BYPASS ENABLED)`);
    console.log(`To: ${to}`);
    console.log(`Election: ${electionTitle}`);
    console.log(`Tx Hash: ${txHash}`);
    console.log(`Verify URL: ${verifyUrl}`);
    console.log(`(Candidate name intentionally omitted for receipt-freeness)`);
    console.log(`==================================================\n`);
    return;
  }

  const text = [
    'Vote Cast Successfully',
    '',
    `Your vote in ${electionTitle} has been securely recorded on the blockchain.`,
    'For your privacy, the candidate you voted for is not included in this receipt.',
    '',
    `Transaction Hash: ${txHash}`,
    '',
    `Verify your vote: ${verifyUrl}`,
  ].join('\n');

  try {
    const result = await sendEmail({ to, subject, html, text, logLabel: 'Receipt' });
    if (result.skipped) return;
  } catch (err) {
    console.error(`[mailer] Failed to send receipt email to ${to}:`, err);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n==================================================`);
      console.log(`[DEV MODE] VOTE RECEIPT EMAIL FALLBACK`);
      console.log(`To: ${to}`);
      console.log(`Election: ${electionTitle}`);
      console.log(`Tx Hash: ${txHash}`);
      console.log(`Verify URL: ${verifyUrl}`);
      console.log(`(Candidate name intentionally omitted for receipt-freeness)`);
      console.log(`==================================================\n`);
      return;
    }
    throw err;
  }
}

/**
 * Send a password-reset link to an admin.
 */
export async function sendPasswordResetEmail(to, { resetUrl }) {
  const subject = 'Reset your password — Block Vote';

  if (process.env.NODE_ENV === 'development' && process.env.DEV_SKIP_EMAIL === 'true') {
    console.log(`\n==================================================`);
    console.log(`[DEV MODE] PASSWORD RESET EMAIL FALLBACK (BYPASS ENABLED)`);
    console.log(`To: ${to}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`==================================================\n`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:linear-gradient(135deg,#0ea5e9,#0369a1);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Block Vote</h1>
                  <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Password Reset</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px;">
                  <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
                    We received a request to reset your Block Vote admin password.
                    Click the button below to choose a new password. This link expires in
                    <strong style="color:#e2e8f0;">30 minutes</strong>.
                  </p>
                  <div style="text-align:center;margin:0 0 24px;">
                    <a href="${resetUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;">
                      Reset Password
                    </a>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                    If you didn't request this, you can safely ignore this email.<br />
                    Or open this link directly:<br />
                    <a href="${resetUrl}" style="color:#7dd3fc;text-decoration:none;word-break:break-all;">${resetUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#0f172a;padding:20px 36px;border-top:1px solid #1e293b;">
                  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                    Block Vote · Admin on web · Vote on mobile
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    'BLOCK VOTE — Password Reset',
    '',
    'We received a request to reset your Block Vote admin password.',
    'Click the link below to choose a new password. It expires in 30 minutes.',
    '',
    resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email.",
  ].join('\n');

  try {
    const result = await sendEmail({ to, subject, html, text, logLabel: 'Password reset' });
    if (result.skipped) return;
  } catch (err) {
    console.error(`[mailer] Failed to send password reset email to ${to}:`, err);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n==================================================`);
      console.log(`[DEV MODE] PASSWORD RESET EMAIL FALLBACK`);
      console.log(`To: ${to}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log(`==================================================\n`);
      return;
    }
    throw err;
  }
}

/**
 * Invite a registered voter to cast their ballot in the mobile app.
 */
export async function sendVoteInviteEmail(
  to,
  {
    voterName = 'Voter',
    electionTitle = 'Election',
    inviteUrl,
    deepLink,
  },
) {
  const subject = `Cast your vote — ${electionTitle}`;
  const hours = describeVotingHours();

  if (process.env.NODE_ENV === 'development' && process.env.DEV_SKIP_EMAIL === 'true') {
    console.log(`\n==================================================`);
    console.log(`[DEV MODE] VOTE INVITE EMAIL FALLBACK (BYPASS ENABLED)`);
    console.log(`To: ${to}`);
    console.log(`Election: ${electionTitle}`);
    console.log(`Invite URL: ${inviteUrl}`);
    console.log(`Deep link: ${deepLink}`);
    console.log(`==================================================\n`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:linear-gradient(135deg,#0ea5e9,#0369a1);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">You're invited to vote</h1>
                  <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Open the Block Vote mobile app</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px;">
                  <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
                    Hi ${voterName}, you are registered for
                    <strong style="color:#ffffff;">${electionTitle}</strong>.
                    Vote in the Block Vote Android app between <strong style="color:#ffffff;">${hours}</strong>.
                    You can change your app vote once if you change your mind — the latest one counts.
                  </p>
                  <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
                    Prefer to vote in person, or were you pressured to vote a certain way? Visit your
                    polling station. A polling-station vote is final and replaces any app vote.
                  </p>
                  <div style="text-align:center;margin:0 0 24px;">
                    <a href="${inviteUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">
                      Open app &amp; cast vote
                    </a>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                    If the button does not open the app, paste this link on your phone:<br />
                    <a href="${inviteUrl}" style="color:#7dd3fc;text-decoration:none;word-break:break-all;">${inviteUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#0f172a;padding:20px 36px;border-top:1px solid #1e293b;">
                  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                    Block Vote · Android app · In-person polling stations
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    `You're invited to vote in ${electionTitle}`,
    '',
    `Hi ${voterName}, you are registered for ${electionTitle}.`,
    `Vote in the Block Vote Android app between ${hours}. You can change your app vote once — the latest one counts.`,
    'Or vote in person at your polling station. A polling-station vote is final and replaces any app vote.',
    '',
    `Open app & cast vote: ${inviteUrl}`,
  ].join('\n');

  try {
    const result = await sendEmail({ to, subject, html, text, logLabel: 'Invite' });
    if (result.skipped) return;
  } catch (err) {
    console.error(`[mailer] Failed to send invite email to ${to}:`, err);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n==================================================`);
      console.log(`[DEV MODE] VOTE INVITE EMAIL FALLBACK`);
      console.log(`To: ${to}`);
      console.log(`Invite URL: ${inviteUrl}`);
      console.log(`==================================================\n`);
      return;
    }
    throw err;
  }
}
