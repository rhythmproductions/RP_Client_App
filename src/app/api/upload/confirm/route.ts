import { NextRequest, NextResponse } from 'next/server';
import { findSubmission, updateSubmission } from '@/lib/db';
import { notifyNewSubmission } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FileResult = { storedName: string; driveFileId: string };

/**
 * Phase 2 — client calls this after all files have finished uploading
 * directly to Google Drive. The client tells us the Drive fileId it
 * received for each upload; we attach those to the submission metadata
 * and mark it complete.
 */
export async function POST(req: NextRequest) {
  let body: { submissionId?: string; files?: FileResult[] };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const submissionId = (body.submissionId ?? '').trim();
  const fileResults = Array.isArray(body.files) ? body.files : [];
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

  // Merge driveFileId into each StoredFile by matching on storedName.
  const idByName = new Map(
    fileResults
      .filter((r) => r && r.storedName && r.driveFileId)
      .map((r) => [r.storedName, r.driveFileId] as const),
  );

  const updatedFiles = existing.files.map((f) => {
    const driveFileId = idByName.get(f.storedName);
    return driveFileId ? { ...f, driveFileId } : f;
  });

  const missing = updatedFiles.filter((f) => !f.driveFileId);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Some files were not reported as uploaded (${missing.length}/${updatedFiles.length}).`,
      },
      { status: 400 },
    );
  }

  const updated = await updateSubmission(submissionId, {
    files: updatedFiles,
    status: 'complete',
  });

  let emailStatus = 'skipped';
  if (updated) {
    try {
      await notifyNewSubmission(updated);
      emailStatus = 'sent';
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('Email notification failed:', detail);
      emailStatus = `failed: ${detail}`;
    }
  }

  return NextResponse.json({ ok: true, emailStatus }, { status: 200 });
}
