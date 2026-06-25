import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import {
  addReview,
  findReview,
  kindOf,
  sanitizeFilename,
  type PostType,
  type ReviewMedia,
  type ReviewPost,
} from '@/lib/reviews';
import { createResumableUploadSession } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 100;
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const POST_TYPES: PostType[] = ['single', 'carousel', 'reel', 'video'];

type IncomingFile = { name: string; size: number; type: string };
type IncomingPost = {
  type?: string;
  description?: string;
  caption?: string;
  date?: string;
  files?: IncomingFile[];
};

/**
 * POST /api/reviews/[token]/posts
 * Append one or more posts to an existing (published) review and return a
 * Drive upload session per new file. Admin only.
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

  let body: { posts?: IncomingPost[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const incomingPosts = body.posts ?? [];
  if (incomingPosts.length === 0) {
    return NextResponse.json({ error: 'No posts provided.' }, { status: 400 });
  }

  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const newPosts: ReviewPost[] = [];
  const uploads: { storedName: string; sessionUri: string }[] = [];
  let fileCount = 0;

  try {
    for (const incoming of incomingPosts) {
      const type = (incoming.type ?? '') as PostType;
      if (!POST_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Unknown post type "${incoming.type}".` },
          { status: 400 },
        );
      }
      const files = incoming.files ?? [];
      if (files.length === 0) {
        return NextResponse.json(
          { error: 'Every post needs at least one photo or video.' },
          { status: 400 },
        );
      }

      const media: ReviewMedia[] = [];
      for (const f of files) {
        fileCount += 1;
        if (fileCount > MAX_FILES) {
          return NextResponse.json(
            { error: `Too many files at once (max ${MAX_FILES}).` },
            { status: 400 },
          );
        }
        const kind = kindOf(f.type || '');
        if (kind === 'other') {
          return NextResponse.json(
            { error: `"${f.name}" is not a photo or video.` },
            { status: 400 },
          );
        }
        if (f.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: `"${f.name}" is too large.` },
            { status: 413 },
          );
        }
        const storedName = `${review.token}__${crypto.randomUUID()}__${sanitizeFilename(f.name)}`;
        const sessionUri = await createResumableUploadSession({
          filename: storedName,
          mimeType: f.type || 'application/octet-stream',
          size: f.size,
          origin,
        });
        media.push({
          originalName: f.name,
          storedName,
          mimeType: f.type || 'application/octet-stream',
          size: f.size,
          kind,
        });
        uploads.push({ storedName, sessionUri });
      }

      newPosts.push({
        id: crypto.randomUUID(),
        type,
        description: (incoming.description ?? '').trim(),
        caption: (incoming.caption ?? '').trim(),
        media,
        decision: 'pending',
        date: incoming.date?.trim() || undefined,
      });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Failed to prepare added posts:', detail, err);
    return NextResponse.json(
      { error: `Could not prepare upload: ${detail}` },
      { status: 500 },
    );
  }

  await addReview({ ...review, posts: [...review.posts, ...newPosts] });

  return NextResponse.json({ uploads }, { status: 201 });
}
