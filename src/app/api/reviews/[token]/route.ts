import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  findReview,
  deleteReview,
  updateReview,
  type DisplayMode,
} from '@/lib/reviews';
import { deleteDriveFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODES: DisplayMode[] = ['feed', 'calendar'];

/**
 * PATCH /api/reviews/[token]
 * Update review-level settings (display mode, project name). Admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { displayMode?: string; projectName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const patch: { displayMode?: DisplayMode; projectName?: string } = {};
  if (body.displayMode !== undefined) {
    if (!MODES.includes(body.displayMode as DisplayMode)) {
      return NextResponse.json({ error: 'Unknown display mode.' }, { status: 400 });
    }
    patch.displayMode = body.displayMode as DisplayMode;
  }
  if (body.projectName !== undefined) {
    patch.projectName = body.projectName.trim() || undefined;
  }

  const updated = await updateReview(params.token, patch);
  if (!updated) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, review: updated });
}

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
