import { Resend } from 'resend';
import type { Submission } from './db';
import type { Review, ReviewPost } from './reviews';

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

  const siteBase =
    process.env.NEXT_PUBLIC_REVIEW_BASE_URL ??
    process.env.URL ??
    'https://rp-client-upload.netlify.app';
  const adminUrl = `${siteBase}/admin`;

  const subject = `New upload from ${sub.clientName}${sub.projectName ? ` — ${sub.projectName}` : ''}`;

  const annotatedFiles = sub.files.filter((f) => f.title || f.notes);

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
        ${sub.projectName ? `<tr>
          <td style="padding: 8px 0; color: #71717a;">Project</td>
          <td style="padding: 8px 0;">${sub.projectName}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Files</td>
          <td style="padding: 8px 0;">${fileSummary} (${formatBytes(totalSize)})</td>
        </tr>
      </table>

      ${annotatedFiles.length > 0 ? `
        <h3 style="color: #27272a; margin-top: 24px; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em;">File notes</h3>
        <ul style="margin: 0 0 16px 0; padding-left: 18px; color: #3f3f46; font-size: 14px;">
          ${annotatedFiles.map((f) => `
            <li style="margin: 6px 0;">
              <strong>${f.title || f.originalName}</strong>${f.notes ? ` — ${f.notes}` : ''}
            </li>
          `).join('')}
        </ul>
      ` : ''}

      <a href="${adminUrl}" style="display: inline-block; background: #D9232B; color: white; padding: 10px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">
        View in Dashboard
      </a>

      <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px;">
        Rhythm Productions — Client Upload Portal
      </p>
    </div>
  `.trim();

  try {
    const result = await resend.emails.send({
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

const POST_TYPE_LABEL: Record<ReviewPost['type'], string> = {
  single: 'Single photo',
  carousel: 'Multi-photo carousel',
  reel: 'Reel',
  video: 'Video',
};

/**
 * Notify the studio when a client approves a post or requests changes on
 * a deliverable review. Fails loudly to the caller (which logs) but never
 * blocks the client's decision from being saved.
 */
export async function notifyReviewDecision(
  review: Review,
  post: ReviewPost,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const approved = post.decision === 'approved';
  const postIndex = review.posts.findIndex((p) => p.id === post.id) + 1;
  const postLabel = `Post ${postIndex} · ${POST_TYPE_LABEL[post.type]}`;

  const approvedCount = review.posts.filter(
    (p) => p.decision === 'approved',
  ).length;
  const changesCount = review.posts.filter(
    (p) => p.decision === 'changes_requested',
  ).length;
  const pendingCount = review.posts.filter(
    (p) => p.decision === 'pending',
  ).length;

  const siteBase =
    process.env.NEXT_PUBLIC_REVIEW_BASE_URL ??
    process.env.URL ??
    'https://rp-client-upload.netlify.app';
  const reviewUrl = `${siteBase}/portal`;

  const verb = approved ? 'approved a post' : 'requested changes';
  const subject = `${review.clientName} ${verb}${review.projectName ? ` — ${review.projectName}` : ''}`;

  const captionPreview = post.caption
    ? post.caption.length > 200
      ? `${post.caption.slice(0, 200)}…`
      : post.caption
    : '(no caption)';

  const statusColor = approved ? '#16a34a' : '#D9232B';
  const statusText = approved ? 'Approved' : 'Changes requested';

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: ${statusColor}; margin-bottom: 4px;">${statusText}</h2>
      <p style="color: #71717a; margin-top: 0;">
        <strong>${review.clientName}</strong> just reviewed
        ${review.projectName ? `"${review.projectName}"` : 'a deliverable'}.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 0; color: #71717a; width: 110px;">Post</td>
          <td style="padding: 8px 0; font-weight: 600;">${postLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a; vertical-align: top;">Caption</td>
          <td style="padding: 8px 0; color: #3f3f46; white-space: pre-wrap;">${captionPreview}</td>
        </tr>
        ${
          !approved && post.changeRequest
            ? `<tr>
          <td style="padding: 8px 0; color: #71717a; vertical-align: top;">Requested</td>
          <td style="padding: 8px 0; color: #18181b; white-space: pre-wrap; font-weight: 500;">${post.changeRequest}</td>
        </tr>`
            : ''
        }
      </table>

      <p style="color: #52525b; font-size: 13px; margin: 16px 0;">
        Review status: ${approvedCount} approved · ${changesCount} need changes · ${pendingCount} pending
        (of ${review.posts.length}).
      </p>

      <a href="${reviewUrl}" style="display: inline-block; background: #D9232B; color: white; padding: 10px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Open Reviews Dashboard
      </a>

      <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px;">
        Rhythm Productions — Client Approvals
      </p>
    </div>
  `.trim();

  try {
    const result = await resend.emails.send({
      from: 'Rhythm Productions <onboarding@resend.dev>',
      to: [NOTIFY_TO],
      subject,
      html,
    });

    if (result.error) {
      throw new Error(`Resend API error: ${JSON.stringify(result.error)}`);
    }
  } catch (err) {
    console.error('Failed to send review notification email:', err);
    throw err;
  }
}
