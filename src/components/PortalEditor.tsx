'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { DisplayMode, PostType, ReviewPost } from '@/lib/reviews';
import { uploadFileToDriveSession } from '@/lib/driveUpload';
import {
  buildWeeks,
  dayName,
  parseYmd,
  shortDate,
  ymd,
} from '@/lib/calendar';

// ── Config ──────────────────────────────────────────────────────────

const POST_TYPES: { value: PostType; label: string; accept: string; multiple: boolean }[] = [
  { value: 'single', label: 'Single photo', accept: 'image/*', multiple: false },
  { value: 'carousel', label: 'Multi-photo', accept: 'image/*', multiple: true },
  { value: 'reel', label: 'Reel', accept: 'video/*', multiple: false },
  { value: 'video', label: 'Video', accept: 'video/*', multiple: false },
];

const POST_TYPE_LABEL: Record<PostType, string> = {
  single: 'Single photo',
  carousel: 'Carousel',
  reel: 'Reel',
  video: 'Video',
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function mediaUrl(token: string, storedName: string) {
  return `/api/review-media/${token}/${encodeURIComponent(storedName)}`;
}

type NewFile = { id: string; file: File; previewUrl: string; kind: 'image' | 'video' };

type Editing =
  | { kind: 'new'; date?: string }
  | { kind: 'edit'; post: ReviewPost };

// ── The editor panel (shared by add + edit) ─────────────────────────

function PostEditorPanel({
  token,
  editing,
  showDate,
  onClose,
}: {
  token: string;
  editing: Editing;
  showDate: boolean;
  onClose: () => void;
}) {
  const existing = editing.kind === 'edit' ? editing.post : null;
  const [type, setType] = useState<PostType>(existing?.type ?? 'single');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [caption, setCaption] = useState(existing?.caption ?? '');
  const [date, setDate] = useState(
    existing?.date ?? (editing.kind === 'new' ? editing.date ?? '' : ''),
  );
  // Existing media kept vs removed.
  const [keptMedia, setKeptMedia] = useState(existing?.media ?? []);
  const [newFiles, setNewFiles] = useState<NewFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const typeConfig = POST_TYPES.find((t) => t.value === type)!;

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const incoming: NewFile[] = [];
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) continue;
        incoming.push({
          id: uid(),
          file,
          previewUrl: URL.createObjectURL(file),
          kind: isImage ? 'image' : 'video',
        });
      }
      setNewFiles((prev) =>
        typeConfig.multiple ? [...prev, ...incoming] : incoming.slice(-1),
      );
    },
    [typeConfig.multiple],
  );

  const totalMedia = keptMedia.length + newFiles.length;
  const canSave = totalMedia > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const filesPayload = newFiles.map((f) => ({
        name: f.file.name,
        size: f.file.size,
        type: f.file.type,
      }));

      if (editing.kind === 'new') {
        // Create the post (with its files) on the review.
        const res = await fetch(`/api/reviews/${token}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            posts: [
              { type, description, caption, date: date || undefined, files: filesPayload },
            ],
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed.');
        const { uploads } = (await res.json()) as {
          uploads: { storedName: string; sessionUri: string }[];
        };
        await uploadAll(uploads);
      } else {
        // Edit: patch text + drop removed media (resets to pending).
        const removeMedia = (existing?.media ?? [])
          .filter((m) => !keptMedia.some((k) => k.storedName === m.storedName))
          .map((m) => m.storedName);
        const patchRes = await fetch(
          `/api/reviews/${token}/posts/${editing.post.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type,
              description,
              caption,
              date: showDate ? date || null : undefined,
              removeMedia,
            }),
          },
        );
        if (!patchRes.ok)
          throw new Error((await patchRes.json().catch(() => ({}))).error ?? 'Save failed.');

        // Upload any newly added media to this post.
        if (filesPayload.length > 0) {
          const mediaRes = await fetch(
            `/api/reviews/${token}/posts/${editing.post.id}/media`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ files: filesPayload }),
            },
          );
          if (!mediaRes.ok)
            throw new Error((await mediaRes.json().catch(() => ({}))).error ?? 'Upload prep failed.');
          const { uploads } = (await mediaRes.json()) as {
            uploads: { storedName: string; sessionUri: string }[];
          };
          await uploadAll(uploads);
        }
      }

      newFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  async function uploadAll(uploads: { storedName: string; sessionUri: string }[]) {
    if (uploads.length === 0) return;
    const totalSize = newFiles.reduce((s, f) => s + f.file.size, 0) || 1;
    const loaded = new Array(uploads.length).fill(0);
    const driveIds = await Promise.all(
      uploads.map((u, idx) =>
        uploadFileToDriveSession(newFiles[idx].file, u.sessionUri, (l) => {
          loaded[idx] = l;
          setProgress(Math.min(Math.round((loaded.reduce((a, b) => a + b, 0) / totalSize) * 100), 99));
        }),
      ),
    );
    const confirmRes = await fetch(`/api/reviews/${token}/posts/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: uploads.map((u, idx) => ({ storedName: u.storedName, driveFileId: driveIds[idx] })),
      }),
    });
    if (!confirmRes.ok)
      throw new Error((await confirmRes.json().catch(() => ({}))).error ?? 'Confirm failed.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-card sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand-900">
            {editing.kind === 'edit' ? 'Edit post' : 'New post'}
            {showDate && date && (
              <span className="ml-2 text-sm font-normal text-brand-500">
                {dayName(parseYmd(date))} {shortDate(parseYmd(date))}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded-full text-brand-400 hover:bg-brand-100"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Type */}
        <div className="grid grid-cols-2 gap-2">
          {POST_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                type === t.value
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : 'border-brand-200 bg-white text-brand-600 hover:border-brand-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Media */}
        <div className="mt-3 flex flex-wrap gap-2">
          {keptMedia.map((m) => (
            <div key={m.storedName} className="relative h-20 w-20 overflow-hidden rounded-lg bg-brand-100 ring-1 ring-brand-200">
              {m.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(token, m.storedName)} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={mediaUrl(token, m.storedName)} muted className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => setKeptMedia((prev) => prev.filter((x) => x.storedName !== m.storedName))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-600 text-white"
                aria-label="Remove"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ))}
          {newFiles.map((f) => (
            <div key={f.id} className="relative h-20 w-20 overflow-hidden rounded-lg bg-brand-100 ring-1 ring-accent-300">
              {f.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={f.previewUrl} muted className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(f.previewUrl);
                  setNewFiles((prev) => prev.filter((x) => x.id !== f.id));
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-600 text-white"
                aria-label="Remove"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={typeConfig.accept}
          multiple={typeConfig.multiple}
          className="visually-hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            if (e.target) e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-600 transition hover:border-accent-500 hover:text-accent-700"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {totalMedia === 0 ? 'Add media' : typeConfig.multiple ? 'Add more' : 'Replace media'}
        </button>

        {showDate && (
          <div className="mt-3">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
              Scheduled day
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:border-accent-600 focus:outline-none"
            />
          </div>
        )}

        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Description for the client
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Describe this post to the client…"
          className="mt-1 w-full resize-y rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none"
        />

        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Post copy / caption
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          placeholder="Write the caption the client will approve…"
          className="mt-1 w-full resize-y rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none"
        />

        {existing && existing.changeRequest && (
          <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50 p-2 text-xs text-brand-800">
            <span className="font-semibold text-accent-700">Client asked: </span>
            {existing.changeRequest}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700 ring-1 ring-accent-200">
            {error}
          </p>
        )}

        {busy && progress > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-200">
            <div className="h-full rounded-full bg-accent-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={save}
            className="flex-1 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:text-brand-400"
          >
            {busy ? 'Saving…' : editing.kind === 'edit' ? 'Save & resend for approval' : 'Add post'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full border border-brand-300 px-4 py-2.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
          >
            Cancel
          </button>
        </div>
        {editing.kind === 'edit' && (
          <p className="mt-2 text-center text-[11px] text-brand-400">
            Saving an edit sends this post back to the client as “pending” for re-approval.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Status pill ─────────────────────────────────────────────────────

function StatusPill({ post }: { post: ReviewPost }) {
  if (post.decision === 'approved')
    return <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-200">Approved</span>;
  if (post.decision === 'changes_requested')
    return <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-accent-200">Changes</span>;
  return <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-500">Pending</span>;
}

async function deletePost(token: string, postId: string) {
  if (!confirm('Delete this post and its media? This cannot be undone.')) return;
  const res = await fetch(`/api/reviews/${token}/posts/${postId}`, { method: 'DELETE' });
  if (!res.ok) {
    alert((await res.json().catch(() => ({}))).error ?? 'Delete failed.');
    return;
  }
  window.location.reload();
}

// ── Main editor ─────────────────────────────────────────────────────

export function PortalEditor({
  token,
  clientName,
  initialMode,
  posts,
}: {
  token: string;
  clientName: string;
  initialMode: DisplayMode;
  posts: ReviewPost[];
}) {
  const [mode, setMode] = useState<DisplayMode>(initialMode);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [weekCount, setWeekCount] = useState(4);
  const [savingMode, setSavingMode] = useState(false);

  async function switchMode(next: DisplayMode) {
    if (next === mode) return;
    setSavingMode(true);
    setMode(next);
    await fetch(`/api/reviews/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayMode: next }),
    }).catch(() => {});
    setSavingMode(false);
  }

  const weeks = useMemo(() => buildWeeks(new Date(), weekCount), [weekCount]);
  const postByDate = useMemo(() => {
    const m = new Map<string, ReviewPost>();
    for (const p of posts) if (p.date && !m.has(p.date)) m.set(p.date, p);
    return m;
  }, [posts]);

  return (
    <div className="mx-4 mb-10">
      {/* Mode toggle */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400">View</span>
        <div className="flex rounded-full border border-brand-200 bg-white p-0.5">
          {(['feed', 'calendar'] as DisplayMode[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={savingMode}
              onClick={() => switchMode(m)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                mode === m ? 'bg-accent-600 text-white shadow-soft' : 'text-brand-600 hover:text-accent-600'
              }`}
            >
              {m === 'feed' ? 'One at a time' : 'Calendar'}
            </button>
          ))}
        </div>
      </div>

      {/* FEED MODE */}
      {mode === 'feed' && (
        <div className="flex flex-col gap-3">
          {posts.length === 0 && (
            <div className="rounded-2xl border border-brand-200 bg-white p-6 text-center text-sm text-brand-500 shadow-card">
              No posts yet. Add the first one below.
            </div>
          )}
          {posts.map((p, i) => (
            <div key={p.id} className="flex gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-card">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-900 ring-1 ring-brand-200">
                {p.media[0]?.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(token, p.media[0].storedName)} alt="" className="h-full w-full object-cover" />
                ) : p.media[0]?.kind === 'video' ? (
                  <video src={mediaUrl(token, p.media[0].storedName)} muted className="h-full w-full object-cover" />
                ) : null}
                {p.media.length > 1 && (
                  <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">{p.media.length}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-500">{i + 1}. {POST_TYPE_LABEL[p.type]}</span>
                  <StatusPill post={p} />
                </div>
                {p.caption && <p className="mt-0.5 line-clamp-2 text-xs text-brand-600">{p.caption}</p>}
                {p.decision === 'changes_requested' && p.changeRequest && (
                  <p className="mt-1 line-clamp-2 rounded bg-accent-50 px-2 py-1 text-xs text-brand-800">“{p.changeRequest}”</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setEditing({ kind: 'edit', post: p })} className="rounded-full border border-brand-300 bg-white px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">Edit</button>
                  <button type="button" onClick={() => deletePost(token, p.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100">Delete</button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEditing({ kind: 'new' })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-white px-4 py-3 text-sm font-semibold text-brand-600 transition hover:border-accent-500 hover:text-accent-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Add post
          </button>
        </div>
      )}

      {/* CALENDAR MODE */}
      {mode === 'calendar' && (
        <div className="flex flex-col gap-4">
          {weeks.map((week, wi) => (
            <div key={wi}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400">
                Week of {shortDate(week[0])}
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {week.map((day) => {
                  const key = ymd(day);
                  const post = postByDate.get(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        post
                          ? setEditing({ kind: 'edit', post })
                          : setEditing({ kind: 'new', date: key })
                      }
                      className={`flex min-h-[84px] flex-col rounded-lg border p-1 text-left transition ${
                        post ? 'border-accent-300 bg-white hover:border-accent-500' : 'border-brand-200 bg-brand-50/50 hover:border-brand-300'
                      }`}
                    >
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-400">
                        {dayName(day).slice(0, 3)} {day.getDate()}
                      </span>
                      {post ? (
                        <div className="relative mt-1 flex-1 overflow-hidden rounded bg-brand-900">
                          {post.media[0]?.kind === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl(token, post.media[0].storedName)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-4 w-4 text-white/80" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                          )}
                          <span className={`absolute right-0.5 top-0.5 h-2 w-2 rounded-full ring-1 ring-white ${
                            post.decision === 'approved' ? 'bg-green-500' : post.decision === 'changes_requested' ? 'bg-accent-500' : 'bg-brand-300'
                          }`} />
                        </div>
                      ) : (
                        <div className="mt-1 flex flex-1 items-center justify-center text-brand-300">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setWeekCount((c) => c + 1)}
            className="self-center rounded-full border border-brand-300 bg-white px-4 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            + Add week
          </button>

          {/* Posts without a scheduled day — assign one by editing. */}
          {posts.some((p) => !p.date) && (
            <div className="mt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400">
                Unscheduled — tap to assign a day
              </p>
              <div className="flex flex-wrap gap-2">
                {posts
                  .filter((p) => !p.date)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditing({ kind: 'edit', post: p })}
                      className="relative h-16 w-16 overflow-hidden rounded-lg bg-brand-900 ring-1 ring-brand-200 hover:ring-accent-400"
                    >
                      {p.media[0]?.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(token, p.media[0].storedName)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <svg className="h-4 w-4 text-white/80" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <PostEditorPanel
          token={token}
          editing={editing}
          showDate={mode === 'calendar'}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
