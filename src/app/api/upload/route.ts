import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { addSubmission, type StoredFile, type Submission } from '@/lib/db';
import { createResumableUploadSession } from '@/lib/storage';
import { requireUploadAccess } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 50;
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB per file

type FileInfo = {
  name: string;
  size: number;
  type: string;
  title?: string;
  notes?: string;
};

function sanitizeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() || 'upload';
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 180);
}

function kindOf(mime: string): StoredFile['kind'] {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

/**
 * Phase 1 — client sends text metadata + a list of files (no actual bytes).
 * We create a Google Drive resumable upload session per file and return
 * the session URIs so the client can PUT each file's bytes directly to
 * Google Drive.
 */
export async function POST(req: NextRequest) {
  const access = requireUploadAccess(req);
  if (!access.ok) return access.response;

  let body: {
    clientName?: string;
    clientEmail?: string;
    projectName?: string;
    files?: FileInfo[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const clientName = (body.clientName ?? '').trim();
  const clientEmail = (body.clientEmail ?? '').trim();
  const projectName = (body.projectName ?? '').trim();
  const fileInfos = body.files ?? [];

  if (!clientName) {
    return NextResponse.json(
      { error: 'Please provide your name.' },
      { status: 400 },
    );
  }
  if (fileInfos.length === 0) {
    return NextResponse.json(
      { error: 'Please choose at least one file.' },
      { status: 400 },
    );
  }
  if (fileInfos.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Please upload at most ${MAX_FILES} files at a time.` },
      { status: 400 },
    );
  }

  // Filter to only image/video and validate sizes.
  const validFiles: (FileInfo & { kind: StoredFile['kind'] })[] = [];
  for (const f of fileInfos) {
    const kind = kindOf(f.type || '');
    if (kind === 'other') continue;
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `File "${f.name}" is too large (${Math.round(
            f.size / (1024 * 1024),
          )} MB). Max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB per file.`,
        },
        { status: 413 },
      );
    }
    validFiles.push({ ...f, kind });
  }

  if (validFiles.length === 0) {
    return NextResponse.json(
      { error: 'No valid photo or video files were found.' },
      { status: 400 },
    );
  }

  const submissionId = crypto.randomUUID();
  const storedFiles: StoredFile[] = [];
  const uploads: { storedName: string; sessionUri: string }[] = [];

  // Drive binds CORS on the session URI to whatever Origin we pass in
  // the initial POST, so use the exact origin the browser is on.
  const origin = req.headers.get('origin') ?? req.nextUrl.origin;

  try {
    for (const f of validFiles) {
      const safeName = sanitizeFilename(f.name);
      // Prefix with submission id + uuid so files are unique inside the
      // Shared Drive even if two clients send identical filenames.
      const storedName = `${submissionId}__${crypto.randomUUID()}__${safeName}`;
      const sessionUri = await createResumableUploadSession({
        filename: storedName,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
        origin,
      });

      storedFiles.push({
        originalName: f.name,
        storedName,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
        kind: f.kind,
        title: f.title?.trim() || undefined,
        notes: f.notes?.trim() || undefined,
      });
      uploads.push({ storedName, sessionUri });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Failed to create upload sessions:', detail, err);
    return NextResponse.json(
      { error: `Could not prepare upload: ${detail}` },
      { status: 500 },
    );
  }

  // Store submission metadata as pending. driveFileId on each file is
  // filled in by /api/upload/confirm once the client has finished
  // uploading.
  const submission: Submission = {
    id: submissionId,
    createdAt: new Date().toISOString(),
    clientName,
    clientEmail: clientEmail || undefined,
    projectName: projectName || undefined,
    files: storedFiles,
    status: 'pending',
  };

  try {
    await addSubmission(submission);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Failed to save submission metadata:', detail, err);
    return NextResponse.json(
      { error: `Could not save submission: ${detail}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { submissionId, uploads },
    { status: 201 },
  );
}
