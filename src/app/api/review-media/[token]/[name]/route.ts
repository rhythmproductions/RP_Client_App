import { NextRequest, NextResponse } from 'next/server';
import { findReview } from '@/lib/reviews';
import { fetchDriveMedia } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/review-media/[token]/[name]
 * Public media stream for a published review. The unguessable token is
 * the access credential — anyone with the review link can load its media.
 * Range requests are forwarded to Drive so videos play and seek on iOS.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; name: string } },
) {
  const review = await findReview(params.token);
  if (!review || review.status !== 'published') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const decoded = decodeURIComponent(params.name);
  const media = review.posts
    .flatMap((p) => p.media)
    .find((m) => m.storedName === decoded);

  if (!media || !media.driveFileId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    const range = req.headers.get('range') ?? undefined;
    const upstream = await fetchDriveMedia(media.driveFileId, range);

    if (!upstream.ok && upstream.status !== 206) {
      const detail = await upstream.text().catch(() => '');
      console.error(`Drive media fetch failed (${upstream.status}):`, detail);
      return NextResponse.json({ error: 'File unavailable.' }, { status: 502 });
    }

    const headers = new Headers();
    headers.set('Content-Type', media.mimeType || 'application/octet-stream');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('Content-Disposition', 'inline');

    // Forward range-related headers when Drive returns a partial response.
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    console.error('Failed to stream review media from Drive:', err);
    return NextResponse.json({ error: 'File unavailable.' }, { status: 500 });
  }
}
