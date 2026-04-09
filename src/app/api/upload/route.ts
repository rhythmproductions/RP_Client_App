import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  addSubmission,
  UPLOADS_DIR,
  type StoredFile,
  type Submission,
} from '@/lib/db';

// Run on the Node.js runtime so we can write to disk.
export const runtime = 'nodejs';
// Don't try to cache/optimize this route.
export const dynamic = 'force-dynamic';

const MAX_FILES = 50;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB per submission

function sanitizeFilename(name: string) {
  // Strip path separators and anything sketchy.
  const base = path.basename(name);
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 180);
}

function kindOf(mime: string): StoredFile['kind'] {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid form submission.' },
      { status: 400 },
    );
  }

  const clientName = String(formData.get('clientName') ?? '').trim();
  const clientEmail = String(formData.get('clientEmail') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!clientName) {
    return NextResponse.json(
      { error: 'Please provide your name.' },
      { status: 400 },
    );
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: 'Please choose at least one file.' },
      { status: 400 },
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Please upload at most ${MAX_FILES} files at a time.` },
      { status: 400 },
    );
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: `Submission too large. Max ${Math.round(
          MAX_TOTAL_BYTES / (1024 * 1024),
        )} MB per upload.`,
      },
      { status: 413 },
    );
  }

  const submissionId = crypto.randomUUID();
  const submissionDir = path.join(UPLOADS_DIR, submissionId);
  await fs.mkdir(submissionDir, { recursive: true });

  const stored: StoredFile[] = [];

  try {
    for (const file of files) {
      const mime = file.type || 'application/octet-stream';
      const kind = kindOf(mime);
      if (kind === 'other') {
        // Skip non-media files silently for safety.
        continue;
      }

      const safeName = sanitizeFilename(file.name || 'upload');
      const storedName = `${crypto.randomUUID()}-${safeName}`;
      const destPath = path.join(submissionDir, storedName);

      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(destPath, buf);

      stored.push({
        originalName: file.name,
        storedName,
        mimeType: mime,
        size: file.size,
        kind,
      });
    }

    if (stored.length === 0) {
      // Clean up empty dir.
      await fs.rm(submissionDir, { recursive: true, force: true });
      return NextResponse.json(
        { error: 'No valid photo or video files were found.' },
        { status: 400 },
      );
    }

    const submission: Submission = {
      id: submissionId,
      createdAt: new Date().toISOString(),
      clientName,
      clientEmail: clientEmail || undefined,
      title: title || undefined,
      description: description || undefined,
      files: stored,
    };

    await addSubmission(submission);

    return NextResponse.json({ id: submissionId }, { status: 201 });
  } catch (err) {
    console.error('Upload failed:', err);
    // Best-effort cleanup.
    await fs.rm(submissionDir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json(
      { error: 'The server could not save your upload. Please try again.' },
      { status: 500 },
    );
  }
}
