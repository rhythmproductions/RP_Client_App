import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { findReview, updateReview } from '@/lib/reviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FileResult = { storedName: string; driveFileId: string };

/**
 * Phase 2 (admin) — called after every file has finished uploading to
 * Drive. Attaches the Drive fileIds to the review's media and flips the
 * review from draft to published so the client link goes live.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { token?: string; files?: FileResult[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const fileResults = Array.isArray(body.files) ? body.files : [];
  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
  }

  const existing = await findReview(token);
  if (!existing) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }
  if (existing.status === 'published') {
    return NextResponse.json({ ok: true });
  }

  const idByName = new Map(
    fileResults
      .filter((r) => r && r.storedName && r.driveFileId)
      .map((r) => [r.storedName, r.driveFileId] as const),
  );

  const posts = existing.posts.map((post) => ({
    ...post,
    media: post.media.map((m) => {
      const driveFileId = idByName.get(m.storedName);
      return driveFileId ? { ...m, driveFileId } : m;
    }),
  }));

  const missing = posts.flatMap((p) => p.media).filter((m) => !m.driveFileId);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Some files were not reported as uploaded (${missing.length}).` },
      { status: 400 },
    );
  }

  await updateReview(token, { posts, status: 'published' });

  return NextResponse.json({ ok: true }, { status: 200 });
}
