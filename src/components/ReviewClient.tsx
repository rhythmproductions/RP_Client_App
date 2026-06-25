'use client';

import { useMemo, useState } from 'react';
import type { DisplayMode, PostDecision, PostType, ReviewPost } from '@/lib/reviews';
import { dayName, groupByWeek, parseYmd, shortDate } from '@/lib/calendar';

const POST_TYPE_LABEL: Record<PostType, string> = {
  single: 'Single photo',
  carousel: 'Carousel',
  reel: 'Reel',
  video: 'Video',
};

function mediaUrl(token: string, storedName: string) {
  return `/api/review-media/${token}/${encodeURIComponent(storedName)}`;
}

// ── Media display ───────────────────────────────────────────────────

function Carousel({
  token,
  post,
}: {
  token: string;
  post: ReviewPost;
}) {
  const [index, setIndex] = useState(0);
  const count = post.media.length;
  const current = post.media[index];

  return (
    <div className="relative">
      <div className="aspect-square w-full overflow-hidden rounded-t-2xl bg-brand-900">
        {current.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(token, current.storedName)}
            alt={current.originalName}
            className="h-full w-full object-contain"
          />
        ) : (
          <video
            key={current.storedName}
            src={mediaUrl(token, current.storedName)}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        )}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => setIndex((i) => (i + 1) % count)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {post.media.map((m, i) => (
              <span
                key={m.storedName}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  i === index ? 'bg-white' : 'bg-white/45'
                }`}
              />
            ))}
          </div>
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
            {index + 1}/{count}
          </span>
        </>
      )}
    </div>
  );
}

// ── Per-post card ───────────────────────────────────────────────────

type LocalPost = ReviewPost;

function PostCard({
  token,
  post,
  index,
  hideIndex = false,
  onDecided,
}: {
  token: string;
  post: LocalPost;
  index: number;
  hideIndex?: boolean;
  onDecided: (post: LocalPost) => void;
}) {
  const [showChanges, setShowChanges] = useState(false);
  const [changeText, setChangeText] = useState(post.changeRequest ?? '');
  const [busy, setBusy] = useState<PostDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(decision: PostDecision, changeRequest?: string) {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/review/${token}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, decision, changeRequest }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Something went wrong.');
      }
      const { post: updated } = (await res.json()) as { post: LocalPost };
      onDecided(updated);
      setShowChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(post.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  const approved = post.decision === 'approved';
  const changesRequested = post.decision === 'changes_requested';

  return (
    <article className="fade-in-up overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-card">
      {/* Media */}
      <Carousel token={token} post={post} />

      {/* Body */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">
            {hideIndex ? POST_TYPE_LABEL[post.type] : `Post ${index + 1} · ${POST_TYPE_LABEL[post.type]}`}
          </span>
          {approved && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Approved
            </span>
          )}
          {changesRequested && (
            <span className="flex items-center gap-1 text-xs font-semibold text-accent-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Changes requested
            </span>
          )}
        </div>

        {/* Description — the studio's note about this post */}
        {post.description && (
          <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-700">
            {post.description}
          </p>
        )}

        {/* Caption / post copy */}
        {post.caption ? (
          <div className="group relative rounded-xl bg-brand-50 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400">
              Caption
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-800">
              {post.caption}
            </p>
            <button
              type="button"
              onClick={copyCaption}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400 transition hover:text-accent-600"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copied ? 'Copied' : 'Copy caption'}
            </button>
          </div>
        ) : (
          <p className="text-sm italic text-brand-400">No caption for this post.</p>
        )}

        {/* Existing change request note */}
        {changesRequested && post.changeRequest && (
          <div className="mt-3 rounded-xl border border-accent-200 bg-accent-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
              Your requested changes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-brand-800">
              {post.changeRequest}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700 ring-1 ring-accent-200">
            {error}
          </p>
        )}

        {/* Change request box */}
        {showChanges ? (
          <div className="mt-3">
            <textarea
              autoFocus
              value={changeText}
              onChange={(e) => setChangeText(e.target.value)}
              rows={3}
              placeholder="What would you like changed? (e.g. swap the second photo, tweak the caption wording…)"
              className="w-full resize-none rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy !== null || changeText.trim().length === 0}
                onClick={() => submit('changes_requested', changeText)}
                className="flex-1 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-200 disabled:text-brand-400 disabled:shadow-none"
              >
                {busy === 'changes_requested' ? 'Sending…' : 'Send request'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setShowChanges(false);
                  setChangeText(post.changeRequest ?? '');
                }}
                className="rounded-full border border-brand-300 px-4 py-2.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => submit('approved')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold shadow-soft transition active:scale-[0.99] disabled:opacity-60 ${
                approved
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {busy === 'approved'
                ? 'Saving…'
                : approved
                  ? 'Approved'
                  : 'Approve'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setShowChanges(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:border-accent-400 hover:text-accent-700 active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              {changesRequested ? 'Edit changes' : 'Request changes'}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// ── Top-level review ────────────────────────────────────────────────

export function ReviewClient({
  token,
  clientName,
  projectName,
  displayMode = 'feed',
  posts: initialPosts,
}: {
  token: string;
  clientName: string;
  projectName?: string;
  displayMode?: DisplayMode;
  posts: ReviewPost[];
}) {
  const [posts, setPosts] = useState<LocalPost[]>(initialPosts);

  // Index every post by id so calendar grouping (which works on a trimmed
  // copy) can resolve back to the live, decision-tracked post object.
  const byId = useMemo(() => {
    const m = new Map<string, LocalPost>();
    for (const p of posts) m.set(p.id, p);
    return m;
  }, [posts]);

  const weeks = useMemo(
    () =>
      displayMode === 'calendar'
        ? groupByWeek(posts.map((p) => ({ id: p.id, date: p.date })))
        : [],
    [displayMode, posts],
  );
  const undated = useMemo(
    () => (displayMode === 'calendar' ? posts.filter((p) => !p.date) : []),
    [displayMode, posts],
  );

  const { approved, changes, pending } = useMemo(() => {
    return {
      approved: posts.filter((p) => p.decision === 'approved').length,
      changes: posts.filter((p) => p.decision === 'changes_requested').length,
      pending: posts.filter((p) => p.decision === 'pending').length,
    };
  }, [posts]);

  const handleDecided = (updated: LocalPost) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const allDone = pending === 0;

  return (
    <div className="mx-4 mb-10 flex flex-col gap-5">
      {/* Intro / progress */}
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
        <p className="text-sm text-brand-500">
          Hi <span className="font-semibold text-brand-800">{clientName}</span> —
          here {posts.length === 1 ? 'is your post' : `are your ${posts.length} posts`}{' '}
          for review.
        </p>
        {projectName && (
          <h1 className="mt-1 text-lg font-semibold text-brand-900">
            {projectName}
          </h1>
        )}
        <p className="mt-3 text-xs text-brand-500">
          Tap <span className="font-semibold text-green-600">Approve</span> on each
          post you&apos;re happy with, or{' '}
          <span className="font-semibold text-accent-600">Request changes</span> to
          leave a note. Your choices save instantly — you can come back anytime.
        </p>

        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700 ring-1 ring-green-200">
            {approved} approved
          </span>
          <span className="rounded-full bg-accent-50 px-2.5 py-1 text-accent-700 ring-1 ring-accent-200">
            {changes} changes
          </span>
          <span className="rounded-full bg-brand-100 px-2.5 py-1 text-brand-600">
            {pending} pending
          </span>
        </div>

        {allDone && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 ring-1 ring-green-200">
            All done — thank you! We&apos;ve received your feedback on every post.
          </p>
        )}
      </div>

      {displayMode === 'feed' &&
        posts.map((post, i) => (
          <PostCard
            key={post.id}
            token={token}
            post={post}
            index={i}
            onDecided={handleDecided}
          />
        ))}

      {displayMode === 'calendar' && (
        <>
          {weeks.map((week) => (
            <div key={week.weekStart} className="flex flex-col gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-400">
                Week of {week.weekLabel}
              </p>
              {week.items.map(({ date, post: ref }) => {
                const post = byId.get(ref.id);
                if (!post) return null;
                return (
                  <div key={post.id}>
                    <p className="mb-1 text-sm font-semibold text-brand-800">
                      {dayName(parseYmd(date))}
                      <span className="ml-2 text-xs font-normal text-brand-400">
                        {shortDate(parseYmd(date))}
                      </span>
                    </p>
                    <PostCard
                      token={token}
                      post={post}
                      index={0}
                      hideIndex
                      onDecided={handleDecided}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {undated.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-400">
                Other posts
              </p>
              {undated.map((post) => (
                <PostCard
                  key={post.id}
                  token={token}
                  post={post}
                  index={0}
                  hideIndex
                  onDecided={handleDecided}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
