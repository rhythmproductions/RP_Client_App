import { NextRequest, NextResponse } from 'next/server';
import {
  addReview,
  applyDecision,
  findReview,
  type PostDecision,
} from '@/lib/reviews';
import { notifyReviewDecision } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED: PostDecision[] = ['approved', 'changes_requested'];

/**
 * POST /api/review/[token]/decision
 * Public — the token in the URL is the access credential. Records a
 * single post's decision (approve / request changes) immediately and
 * emails the studio.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  let body: { postId?: string; decision?: string; changeRequest?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const postId = (body.postId ?? '').trim();
  const decision = (body.decision ?? '') as PostDecision;
  const changeRequest = body.changeRequest;

  if (!postId || !ALLOWED.includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  }
  if (decision === 'changes_requested' && !(changeRequest ?? '').trim()) {
    return NextResponse.json(
      { error: 'Please describe the changes you would like.' },
      { status: 400 },
    );
  }

  const review = await findReview(params.token);
  if (!review || review.status !== 'published') {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }

  const result = applyDecision(review, postId, decision, changeRequest);
  if (!result) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  await addReview(result.review);

  let emailStatus = 'skipped';
  try {
    await notifyReviewDecision(result.review, result.post);
    emailStatus = 'sent';
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Review decision email failed:', detail);
    emailStatus = `failed: ${detail}`;
  }

  return NextResponse.json({ ok: true, post: result.post, emailStatus });
}
