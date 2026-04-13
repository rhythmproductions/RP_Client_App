import { Resend } from 'resend';
import type { Submission } from './db';

const NOTIFY_TO = 'info@rhythmproductions.ca';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('RESEND_API_KEY not set — skipping email notification.');
    return null;
  }
  return new Resend(key);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Send a notification email when a client submits media.
 * Fails silently (logs a warning) so uploads still succeed
 * even if email delivery is down.
 */
export async function notifyNewSubmission(sub: Submission): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const totalSize = sub.files.reduce((a, f) => a + f.size, 0);
  const imageCount = sub.files.filter((f) => f.kind === 'image').length;
  const videoCount = sub.files.filter((f) => f.kind === 'video').length;

  const parts: string[] = [];
  if (imageCount > 0) parts.push(`${imageCount} photo${imageCount === 1 ? '' : 's'}`);
  if (videoCount > 0) parts.push(`${videoCount} video${videoCount === 1 ? '' : 's'}`);
  const fileSummary = parts.join(' and ');

  const adminUrl = `${process.env.URL ?? 'https://rp-client-upload.netlify.app'}/admin`;

  const subject = `New upload from ${sub.clientName}${sub.title ? ` — ${sub.title}` : ''}`;

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #D9232B; margin-bottom: 4px;">New Client Upload</h2>
      <p style="color: #71717a; margin-top: 0;">A client just submitted files via the upload portal.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 0; color: #71717a; width: 100px;">Client</td>
          <td style="padding: 8px 0; font-weight: 600;">${sub.clientName}</td>
        </tr>
        ${sub.clientEmail ? `<tr>
          <td style="padding: 8px 0; color: #71717a;">Email</td>
          <td style="padding: 8px 0;"><a href="mailto:${sub.clientEmail}" style="color: #D9232B;">${sub.clientEmail}</a></td>
        </tr>` : ''}
        ${sub.title ? `<tr>
          <td style="padding: 8px 0; color: #71717a;">Title</td>
          <td style="padding: 8px 0;">${sub.title}</td>
        </tr>` : ''}
        ${sub.description ? `<tr>
          <td style="padding: 8px 0; color: #71717a;">Notes</td>
          <td style="padding: 8px 0;">${sub.description}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Files</td>
          <td style="padding: 8px 0;">${fileSummary} (${formatBytes(totalSize)})</td>
        </tr>
      </table>

      <a href="${adminUrl}" style="display: inline-block; background: #D9232B; color: white; padding: 10px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">
        View in Dashboard
      </a>

      <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px;">
        Rhythm Productions — Client Upload Portal
      </p>
    </div>
  `.trim();

  try {
    await resend.emails.send({
      from: 'Rhythm Productions <onboarding@resend.dev>',
      to: [NOTIFY_TO],
      subject,
      html,
    });

    if (result.error) {
      throw new Error(`Resend API error: ${JSON.stringify(result.error)}`);
    }
  } catch (err) {
    console.error('Failed to send notification email:', err);
    throw err;
  }
}
