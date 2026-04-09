import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR, findSubmission } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; name: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const submission = await findSubmission(params.id);
  if (!submission) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const decoded = decodeURIComponent(params.name);
  const fileMeta = submission.files.find((f) => f.storedName === decoded);
  if (!fileMeta) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  // Guard against path traversal.
  const safeName = path.basename(fileMeta.storedName);
  const filePath = path.join(UPLOADS_DIR, submission.id, safeName);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    const buf = await fs.readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': fileMeta.mimeType,
        'Content-Length': String(buf.byteLength),
        'Cache-Control': 'private, max-age=60',
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          fileMeta.originalName,
        )}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File missing.' }, { status: 404 });
  }
}
