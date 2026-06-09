import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { findReview, deleteReview } from '@/lib/reviews';
import { deleteDriveFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/reviews/[token]
 * Removes a review's metadata from Netlify Blobs and every one of its
 * media files from Google Drive. Requires admin auth.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const review = await findReview(params.token);
  if (!review) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const driveIds = review.posts
    .flatMap((p) => p.media)
    .map((m) => m.driveFileId)
    .filter((id): id is string => !!id);

  await Promise.all(
    driveIds.map(async (id) => {
      try {
        await deleteDriveFile(id);
      } catch (err) {
        console.error(`Failed to delete Drive file ${id}:`, err);
      }
    }),
  );

  await deleteReview(params.token);

  return NextResponse.json({ ok: true });
}
