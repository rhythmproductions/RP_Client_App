import { getStore } from '@netlify/blobs';

// ── Types ───────────────────────────────────────────────────────────

export type ReviewMediaKind = 'image' | 'video';

export type ReviewMedia = {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  kind: ReviewMediaKind;
  // Set once the file finishes uploading to Google Drive.
  driveFileId?: string;
};

// The kind of social post being delivered for approval.
export type PostType = 'single' | 'carousel' | 'reel' | 'video';

// Where a post sits in the client's review.
export type PostDecision = 'pending' | 'approved' | 'changes_requested';

export type ReviewPost = {
  id: string;
  type: PostType;
  // A note from the studio describing this post to the client (context,
  // intent, where it'll run) — separate from the caption being approved.
  description: string;
  // The caption / post copy the client is approving.
  caption: string;
  // 1 item for single/reel/video, many for a carousel.
  media: ReviewMedia[];
  decision: PostDecision;
  // The client's note when they request changes.
  changeRequest?: string;
  // ISO timestamp of the most recent client decision on this post.
  decidedAt?: string;
  // Calendar mode: the scheduled day as a YYYY-MM-DD string. Unused in
  // feed mode.
  date?: string;
};

// How a client portal lays its content out.
export type DisplayMode = 'feed' | 'calendar';

export type Review = {
  // Unguessable token — doubles as the blob key and the public URL slug
  // (rhythmproductions.ca/review/<token>). Whoever has it can view and
  // act on the review, so it must stay secret.
  token: string;
  createdAt: string; // ISO
  clientName: string;
  clientEmail?: string;
  // Overall campaign / batch name, e.g. "June content — week 2".
  projectName?: string;
  posts: ReviewPost[];
  // 'draft' while media is still uploading; 'published' once the link
  // is live and the client can review it.
  status: 'draft' | 'published';
  // How the portal presents posts. Defaults to 'feed' when absent.
  displayMode?: DisplayMode;
};

// ── Blob store ──────────────────────────────────────────────────────

function getReviewsStore() {
  return getStore({ name: 'reviews', consistency: 'strong' });
}

// ── Public API ──────────────────────────────────────────────────────

export async function addReview(review: Review): Promise<void> {
  const store = getReviewsStore();
  await store.setJSON(review.token, review);
}

export async function findReview(token: string): Promise<Review | null> {
  const store = getReviewsStore();
  const data = await store.get(token, { type: 'json' });
  return (data as Review) ?? null;
}

export async function updateReview(
  token: string,
  patch: Partial<Review>,
): Promise<Review | null> {
  const existing = await findReview(token);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await addReview(updated);
  return updated;
}

export async function deleteReview(token: string): Promise<boolean> {
  const store = getReviewsStore();
  const existing = await findReview(token);
  if (!existing) return false;
  await store.delete(token);
  return true;
}

/**
 * List published reviews, newest first. Drafts (still uploading) are
 * hidden from the admin dashboard until they go live.
 */
export async function listReviews(): Promise<Review[]> {
  const store = getReviewsStore();
  const { blobs } = await store.list();

  const reviews = await Promise.all(
    blobs.map(async (entry) => {
      const data = await store.get(entry.key, { type: 'json' });
      return data as Review | null;
    }),
  );

  return reviews
    .filter((r): r is Review => r !== null && r.status === 'published')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Helpers ─────────────────────────────────────────────────────────

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'upload';
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 180);
}

export function kindOf(mime: string): ReviewMediaKind | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

/** Apply a client decision to a single post, returning the updated post. */
export function applyDecision(
  review: Review,
  postId: string,
  decision: PostDecision,
  changeRequest?: string,
): { review: Review; post: ReviewPost } | null {
  const idx = review.posts.findIndex((p) => p.id === postId);
  if (idx === -1) return null;

  const post: ReviewPost = {
    ...review.posts[idx],
    decision,
    changeRequest:
      decision === 'changes_requested'
        ? (changeRequest ?? '').trim() || undefined
        : undefined,
    decidedAt: new Date().toISOString(),
  };

  const posts = [...review.posts];
  posts[idx] = post;
  return { review: { ...review, posts }, post };
}
