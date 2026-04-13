import { NextRequest, NextResponse } from 'next/server';
import { findSubmission, deleteSubmission } from '@/lib/db';
import { deleteSubmissionFiles } from '@/lib/storage';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/submissions/[id]
 * Deletes a submission's metadata from Netlify Blobs and all its
 * files from Supabase Storage. Requires admin auth.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const submission = await findSubmission(params.id);
  if (!submission) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    // Delete files from Supabase Storage.
    const storedNames = submission.files.map((f) => f.storedName);
    await deleteSubmissionFiles(submission.id, storedNames);
  } catch (err) {
    console.error('Failed to delete files from storage:', err);
    // Continue to delete metadata even if storage deletion fails.
  }

  // Delete metadata from Netlify Blobs.
  await deleteSubmission(params.id);

  return NextResponse.json({ ok: true });
}
