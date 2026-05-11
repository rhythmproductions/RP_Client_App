import { NextRequest, NextResponse } from 'next/server';
import { findSubmission, deleteSubmission } from '@/lib/db';
import { deleteDriveFile } from '@/lib/storage';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/submissions/[id]
 * Removes a submission's metadata from Netlify Blobs and all of its
 * files from Google Drive. Requires admin auth.
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

  // Delete each file from Drive. Run in parallel; ignore individual
  // failures (a missing file shouldn't block deleting the metadata).
  await Promise.all(
    submission.files
      .filter((f) => !!f.driveFileId)
      .map(async (f) => {
        try {
          await deleteDriveFile(f.driveFileId!);
        } catch (err) {
          console.error(
            `Failed to delete Drive file ${f.driveFileId} (${f.storedName}):`,
            err,
          );
        }
      }),
  );

  await deleteSubmission(params.id);

  return NextResponse.json({ ok: true });
}
