import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { addReview, findReview } from '@/lib/reviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FileResult = { storedName: string; driveFileId: string };

/**
 * POST /api/reviews/[token]/posts/confirm
 * Attach Drive fileIds to whichever media (across any post) match the
 * given storedNames, after the browser finishes uploading. Admin only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const review = await findReview(params.token);
  if (!review) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let body: { files?: FileResult[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const idByName = new Map(
    (body.files ?? [])
      .filter((r) => r && r.storedName && r.driveFileId)
      .map((r) => [r.storedName, r.driveFileId] as const),
  );

  const posts = review.posts.map((post) => ({
    ...post,
    media: post.media.map((m) => {
      const driveFileId = idByName.get(m.storedName);
      return driveFileId ? { ...m, driveFileId } : m;
    }),
  }));

  await addReview({ ...review, posts });

  return NextResponse.json({ ok: true });
}
