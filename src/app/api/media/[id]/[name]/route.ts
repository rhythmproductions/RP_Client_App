import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { findSubmission } from '@/lib/db';
import { getFileStream } from '@/lib/storage';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Streams a file's bytes from Google Drive through this route. Admin only.
 * Add ?download=1 to force a download rather than inline display.
 */
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
  if (!fileMeta.driveFileId) {
    return NextResponse.json(
      { error: 'File upload was not completed.' },
      { status: 404 },
    );
  }

  try {
    const nodeStream = await getFileStream(fileMeta.driveFileId);
    // Convert the Node stream to a Web ReadableStream so Next.js can
    // hand it to the platform as the response body.
    const webStream = Readable.toWeb(nodeStream as Readable) as WebReadableStream<Uint8Array>;

    const wantDownload = req.nextUrl.searchParams.get('download') === '1';
    const headers = new Headers();
    headers.set('Content-Type', fileMeta.mimeType || 'application/octet-stream');
    headers.set('Content-Length', String(fileMeta.size));
    if (wantDownload) {
      headers.set(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(fileMeta.originalName)}`,
      );
    } else {
      headers.set('Content-Disposition', 'inline');
    }
    headers.set('Cache-Control', 'private, no-store');

    return new Response(webStream as unknown as BodyInit, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Failed to stream file from Drive:', err);
    return NextResponse.json({ error: 'File unavailable.' }, { status: 500 });
  }
}
