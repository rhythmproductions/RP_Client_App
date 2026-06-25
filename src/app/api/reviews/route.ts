import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import {
  addReview,
  type PostType,
  type Review,
  type ReviewMedia,
  type ReviewPost,
} from '@/lib/reviews';
import { createResumableUploadSession } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_POSTS = 60;
const MAX_FILES = 100;
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB per file

const POST_TYPES: PostType[] = ['single', 'carousel', 'reel', 'video'];

type IncomingFile = { name: string; size: number; type: string };
type IncomingPost = {
  type?: string;
  description?: string;
  caption?: string;
  files?: IncomingFile[];
};

function sanitizeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() || 'upload';
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 180);
}

function kindOf(mime: string): ReviewMedia['kind'] | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

/**
 * Phase 1 (admin) — receive the review's posts + their file lists, create
 * a Google Drive resumable upload session per file, and store the review
 * as a draft. Returns the public token plus a session URI per file so the
 * browser can PUT the bytes straight to Drive.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: {
    clientName?: string;
    clientEmail?: string;
    projectName?: string;
    posts?: IncomingPost[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const clientName = (body.clientName ?? '').trim();
  const clientEmail = (body.clientEmail ?? '').trim();
  const projectName = (body.projectName ?? '').trim();
  const incomingPosts = body.posts ?? [];

  if (!clientName) {
    return NextResponse.json({ error: 'Please provide a client name.' }, { status: 400 });
  }
  if (incomingPosts.length === 0) {
    return NextResponse.json({ error: 'Add at least one post.' }, { status: 400 });
  }
  if (incomingPosts.length > MAX_POSTS) {
    return NextResponse.json(
      { error: `Too many posts (max ${MAX_POSTS}).` },
      { status: 400 },
    );
  }

  const token = crypto.randomBytes(24).toString('base64url');

  // Drive binds CORS on the session URI to whatever Origin we pass in the
  // initial POST, so use the exact origin the browser is on.
  const origin = req.headers.get('origin') ?? req.nextUrl.origin;

  const posts: ReviewPost[] = [];
  const uploads: { storedName: string; sessionUri: string }[] = [];
  let totalFiles = 0;

  try {
    for (const incoming of incomingPosts) {
      const type = (incoming.type ?? '') as PostType;
      if (!POST_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Unknown post type "${incoming.type}".` },
          { status: 400 },
        );
      }

      const description = (incoming.description ?? '').trim();
      const caption = (incoming.caption ?? '').trim();
      const files = incoming.files ?? [];
      if (files.length === 0) {
        return NextResponse.json(
          { error: 'Every post needs at least one photo or video.' },
          { status: 400 },
        );
      }

      const media: ReviewMedia[] = [];
      for (const f of files) {
        totalFiles += 1;
        if (totalFiles > MAX_FILES) {
          return NextResponse.json(
            { error: `Too many files in this review (max ${MAX_FILES}).` },
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
            {
              error: `"${f.name}" is too large (${Math.round(
                f.size / (1024 * 1024),
              )} MB). Max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB per file.`,
            },
            { status: 413 },
          );
        }

        const safeName = sanitizeFilename(f.name);
        const storedName = `${token}__${crypto.randomUUID()}__${safeName}`;
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

      posts.push({
        id: crypto.randomUUID(),
        type,
        description,
        caption,
        media,
        decision: 'pending',
      });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Failed to create review upload sessions:', detail, err);
    return NextResponse.json(
      { error: `Could not prepare upload: ${detail}` },
      { status: 500 },
    );
  }

  const review: Review = {
    token,
    createdAt: new Date().toISOString(),
    clientName,
    clientEmail: clientEmail || undefined,
    projectName: projectName || undefined,
    posts,
    status: 'draft',
  };

  try {
    await addReview(review);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Failed to save review metadata:', detail, err);
    return NextResponse.json(
      { error: `Could not save review: ${detail}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ token, uploads }, { status: 201 });
}
