import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import {
  addReview,
  findReview,
  kindOf,
  sanitizeFilename,
  type ReviewMedia,
} from '@/lib/reviews';
import { createResumableUploadSession } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 500 * 1024 * 1024;

type IncomingFile = { name: string; size: number; type: string };

/**
 * POST /api/reviews/[token]/posts/[postId]/media
 * Add new media to an existing post, returning a Drive upload session per
 * file. The shared posts/confirm endpoint attaches the fileIds afterward.
 * Admin only.
 */
export async function POST(
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

  let body: { files?: IncomingFile[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const files = body.files ?? [];
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided.' }, { status: 400 });
  }

  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const newMedia: ReviewMedia[] = [];
  const uploads: { storedName: string; sessionUri: string }[] = [];

  try {
    for (const f of files) {
      const kind = kindOf(f.type || '');
      if (kind === 'other') {
        return NextResponse.json(
          { error: `"${f.name}" is not a photo or video.` },
          { status: 400 },
        );
      }
      if (f.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `"${f.name}" is too large.` }, { status: 413 });
      }
      const storedName = `${review.token}__${crypto.randomUUID()}__${sanitizeFilename(f.name)}`;
      const sessionUri = await createResumableUploadSession({
        filename: storedName,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
        origin,
      });
      newMedia.push({
        originalName: f.name,
        storedName,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
        kind,
      });
      uploads.push({ storedName, sessionUri });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Failed to prepare added media:', detail, err);
    return NextResponse.json(
      { error: `Could not prepare upload: ${detail}` },
      { status: 500 },
    );
  }

  const posts = [...review.posts];
  posts[idx] = { ...posts[idx], media: [...posts[idx].media, ...newMedia] };
  await addReview({ ...review, posts });

  return NextResponse.json({ uploads }, { status: 201 });
}
