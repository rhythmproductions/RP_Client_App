import { NextRequest, NextResponse } from 'next/server';
import { findSubmission } from '@/lib/db';
import { createSignedDownloadUrl } from '@/lib/storage';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generates a signed Supabase download URL for the requested file and
 * redirects the browser to it. Add ?download=1 to force the browser
 * to download instead of displaying inline.
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

  try {
    const storagePath = `${submission.id}/${fileMeta.storedName}`;
    const wantDownload = req.nextUrl.searchParams.get('download') === '1';
    const downloadUrl = await createSignedDownloadUrl(
      storagePath,
      wantDownload ? fileMeta.originalName : undefined,
    );
    return NextResponse.redirect(downloadUrl, 302);
  } catch (err) {
    console.error('Failed to create download URL:', err);
    return NextResponse.json({ error: 'File unavailable.' }, { status: 500 });
  }
}
