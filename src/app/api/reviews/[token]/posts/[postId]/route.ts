import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { addReview, findReview, type PostType, type ReviewPost } from '@/lib/reviews';
import { deleteDriveFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POST_TYPES: PostType[] = ['single', 'carousel', 'reel', 'video'];

/**
 * PATCH /api/reviews/[token]/posts/[postId]
 * Edit a post's text/type/date and optionally drop media. Editing content
 * resets the post to 'pending' so the client re-reviews (the back-and-forth
 * loop). Admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string; postId: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const review = await findReview(params.token);
  if (!review) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  const idx = review.posts.findIndex((p) => p.id === params.postId);
  if (idx === -1) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  let body: {
    caption?: string;
    description?: string;
    type?: string;
    date?: string | null;
    removeMedia?: string[];
    resetDecision?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const existing = review.posts[idx];
  const removeSet = new Set(body.removeMedia ?? []);
  const removed = existing.media.filter((m) => removeSet.has(m.storedName));
  const keptMedia = existing.media.filter((m) => !removeSet.has(m.storedName));

  if (body.type !== undefined && !POST_TYPES.includes(body.type as PostType)) {
    return NextResponse.json({ error: 'Unknown post type.' }, { status: 400 });
  }

  // Any content edit pushes the post back to pending for re-approval,
  // unless the caller explicitly opts out.
  const resetDecision = body.resetDecision !== false;

  const updated: ReviewPost = {
    ...existing,
    caption: body.caption !== undefined ? body.caption.trim() : existing.caption,
    description:
      body.description !== undefined ? body.description.trim() : existing.description,
    type: (body.type as PostType) ?? existing.type,
    date:
      body.date === undefined
        ? existing.date
        : body.date
          ? body.date.trim() || undefined
          : undefined,
    media: keptMedia,
    decision: resetDecision ? 'pending' : existing.decision,
    changeRequest: resetDecision ? undefined : existing.changeRequest,
    decidedAt: resetDecision ? undefined : existing.decidedAt,
  };

  const posts = [...review.posts];
  posts[idx] = updated;
  await addReview({ ...review, posts });

  // Delete dropped media from Drive (best-effort).
  await Promise.all(
    removed
      .map((m) => m.driveFileId)
      .filter((id): id is string => !!id)
      .map(async (id) => {
        try {
          await deleteDriveFile(id);
        } catch (err) {
          console.error(`Failed to delete Drive file ${id}:`, err);
        }
      }),
  );

  return NextResponse.json({ ok: true, post: updated });
}

/**
 * DELETE /api/reviews/[token]/posts/[postId]
 * Remove a single post and its Drive media. Admin only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string; postId: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const review = await findReview(params.token);
  if (!review) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  const post = review.posts.find((p) => p.id === params.postId);
  if (!post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  await addReview({
    ...review,
    posts: review.posts.filter((p) => p.id !== params.postId),
  });

  await Promise.all(
    post.media
      .map((m) => m.driveFileId)
      .filter((id): id is string => !!id)
      .map(async (id) => {
        try {
          await deleteDriveFile(id);
        } catch (err) {
          console.error(`Failed to delete Drive file ${id}:`, err);
        }
      }),
  );

  return NextResponse.json({ ok: true });
}
