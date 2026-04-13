import { NextRequest, NextResponse } from 'next/server';
import { findSubmission, updateSubmission } from '@/lib/db';
import { notifyNewSubmission } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 2 — client calls this after all files have been uploaded directly
 * to Supabase. We mark the submission as complete so it appears on the
 * admin page.
 */
export async function POST(req: NextRequest) {
  let body: { submissionId?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const submissionId = (body.submissionId ?? '').trim();
  if (!submissionId) {
    return NextResponse.json(
      { error: 'Missing submissionId.' },
      { status: 400 },
    );
  }

  const existing = await findSubmission(submissionId);
  if (!existing) {
    return NextResponse.json(
      { error: 'Submission not found.' },
      { status: 404 },
    );
  }

  if (existing.status === 'complete') {
    return NextResponse.json({ ok: true });
  }

  const updated = await updateSubmission(submissionId, { status: 'complete' });

  // Send notification email (non-blocking — don't fail the request if email fails).
  if (updated) {
    notifyNewSubmission(updated).catch((err) =>
      console.error('Email notification failed:', err),
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
