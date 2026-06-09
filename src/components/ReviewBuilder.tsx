'use client';

import { useCallback, useRef, useState } from 'react';
import type { PostType } from '@/lib/reviews';

// ── Local types ─────────────────────────────────────────────────────

type DraftMedia = {
  id: string;
  file: File;
  previewUrl: string;
  kind: 'image' | 'video';
};

type DraftPost = {
  id: string;
  type: PostType;
  caption: string;
  media: DraftMedia[];
};

const POST_TYPES: { value: PostType; label: string; accept: string; multiple: boolean }[] = [
  { value: 'single', label: 'Single photo', accept: 'image/*', multiple: false },
  { value: 'carousel', label: 'Multi-photo', accept: 'image/*', multiple: true },
  { value: 'reel', label: 'Reel', accept: 'video/*', multiple: false },
  { value: 'video', label: 'Video', accept: 'video/*', multiple: false },
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** PUT a file to a Drive resumable session URI, tracking progress. */
function uploadToDrive(
  file: File,
  sessionUri: string,
  onProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUri);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { id?: string };
          if (!body.id) return reject(new Error('Drive did not return a file id.'));
          resolve(body.id);
        } catch {
          reject(new Error('Could not parse Drive response.'));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(file);
  });
}

type Status =
  | { state: 'idle' }
  | { state: 'uploading'; progress: number }
  | { state: 'done'; url: string }
  | { state: 'error'; message: string };

// ── One post editor ─────────────────────────────────────────────────

function PostEditor({
  post,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  post: DraftPost;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<DraftPost>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const typeConfig = POST_TYPES.find((t) => t.value === post.type)!;
  const wantsVideo = post.type === 'reel' || post.type === 'video';

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const incoming: DraftMedia[] = [];
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
      // Single-media post types keep only the most recent pick.
      const next = typeConfig.multiple
        ? [...post.media, ...incoming]
        : incoming.slice(-1);
      if (!typeConfig.multiple) post.media.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      onChange({ media: next });
    },
    [post.media, typeConfig.multiple, onChange],
  );

  const removeMedia = (id: string) => {
    const gone = post.media.find((m) => m.id === id);
    if (gone) URL.revokeObjectURL(gone.previewUrl);
    onChange({ media: post.media.filter((m) => m.id !== id) });
  };

  const changeType = (type: PostType) => {
    const cfg = POST_TYPES.find((t) => t.value === type)!;
    const switchingMediaKind =
      (cfg.accept.startsWith('video') && post.media.some((m) => m.kind === 'image')) ||
      (cfg.accept.startsWith('image') && post.media.some((m) => m.kind === 'video'));
    if (switchingMediaKind) {
      post.media.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      onChange({ type, media: [] });
    } else if (!cfg.multiple && post.media.length > 1) {
      onChange({ type, media: post.media.slice(0, 1) });
    } else {
      onChange({ type });
    }
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand-900">Post {index + 1}</h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 text-xs font-medium text-brand-400 transition hover:text-accent-600"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            Remove
          </button>
        )}
      </div>

      {/* Type selector */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {POST_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => changeType(t.value)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              post.type === t.value
                ? 'border-accent-500 bg-accent-50 text-accent-700'
                : 'border-brand-200 bg-white text-brand-600 hover:border-brand-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Media */}
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
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-4 text-sm font-medium text-brand-600 transition hover:border-accent-500 hover:bg-accent-50 hover:text-accent-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {post.media.length === 0
          ? wantsVideo
            ? 'Add video'
            : typeConfig.multiple
              ? 'Add photos'
              : 'Add photo'
          : typeConfig.multiple
            ? 'Add more'
            : 'Replace'}
      </button>

      {post.media.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.media.map((m) => (
            <div
              key={m.id}
              className="relative h-20 w-20 overflow-hidden rounded-lg bg-brand-100 ring-1 ring-brand-200"
            >
              {m.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={m.previewUrl} muted className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(m.id)}
                aria-label="Remove"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-600 text-white shadow-soft"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Caption */}
      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
        Post copy / caption
      </label>
      <textarea
        value={post.caption}
        onChange={(e) => onChange({ caption: e.target.value })}
        rows={4}
        placeholder="Write the caption the client will approve…"
        className="mt-1 w-full resize-y rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

// ── Builder ─────────────────────────────────────────────────────────

function emptyPost(): DraftPost {
  return { id: uid(), type: 'single', caption: '', media: [] };
}

export function ReviewBuilder() {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [posts, setPosts] = useState<DraftPost[]>([emptyPost()]);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [copied, setCopied] = useState(false);

  const updatePost = (id: string, patch: Partial<DraftPost>) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const removePost = (id: string) =>
    setPosts((prev) => {
      const gone = prev.find((p) => p.id === id);
      gone?.media.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      return prev.filter((p) => p.id !== id);
    });

  const totalFiles = posts.reduce((n, p) => n + p.media.length, 0);
  const everyPostHasMedia = posts.every((p) => p.media.length > 0);
  const canSubmit =
    clientName.trim().length > 0 &&
    posts.length > 0 &&
    everyPostHasMedia &&
    status.state !== 'uploading';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ state: 'uploading', progress: 0 });

    // Flatten files in a stable order so we can map session URIs back.
    const flatFiles = posts.flatMap((p) => p.media);

    try {
      // ── Phase 1: create review + get Drive sessions ──
      const prepareRes = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          projectName: projectName.trim(),
          posts: posts.map((p) => ({
            type: p.type,
            caption: p.caption,
            files: p.media.map((m) => ({
              name: m.file.name,
              size: m.file.size,
              type: m.file.type,
            })),
          })),
        }),
      });

      if (!prepareRes.ok) {
        const body = await prepareRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Prepare failed (${prepareRes.status}).`);
      }

      const { token, uploads } = (await prepareRes.json()) as {
        token: string;
        uploads: { storedName: string; sessionUri: string }[];
      };

      // ── Phase 2: upload every file directly to Drive ──
      const totalSize = flatFiles.reduce((s, m) => s + m.file.size, 0) || 1;
      const loaded = new Array(uploads.length).fill(0);
      const tick = () => {
        const sum = loaded.reduce((a, b) => a + b, 0);
        setStatus({
          state: 'uploading',
          progress: Math.min(Math.round((sum / totalSize) * 100), 99),
        });
      };

      const driveIds = await Promise.all(
        uploads.map((u, idx) =>
          uploadToDrive(flatFiles[idx].file, u.sessionUri, (l) => {
            loaded[idx] = l;
            tick();
          }),
        ),
      );

      // ── Phase 3: confirm → publish ──
      const confirmRes = await fetch('/api/reviews/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          files: uploads.map((u, idx) => ({
            storedName: u.storedName,
            driveFileId: driveIds[idx],
          })),
        }),
      });

      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'Confirmation failed.');
      }

      const url = `${window.location.origin}/review/${token}`;
      flatFiles.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      setStatus({ state: 'done', url });
    } catch (err) {
      setStatus({
        state: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      });
    }
  }

  // ── Success screen ──
  if (status.state === 'done') {
    return (
      <div className="fade-in-up mx-4 mb-10 rounded-2xl border border-brand-200 bg-white p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 ring-1 ring-green-200">
          <svg className="h-7 w-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-brand-900">Review is live</h2>
        <p className="mt-2 text-sm text-brand-500">
          Send this private link to your client. Only people with the link can
          open it.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-2">
          <input
            readOnly
            value={status.url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-brand-800 focus:outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(status.url).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <a
            href="/admin/reviews"
            className="rounded-full border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
          >
            View all reviews
          </a>
          <button
            type="button"
            onClick={() => {
              setClientName('');
              setClientEmail('');
              setProjectName('');
              setPosts([emptyPost()]);
              setStatus({ state: 'idle' });
            }}
            className="rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500"
          >
            New review
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-4 mb-10 flex flex-col gap-5">
      {/* Client details */}
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Client name
        </label>
        <input
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Riverside Café"
          className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
        />
        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Client email (optional)
        </label>
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="hello@client.com"
          className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
        />
        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Project / batch name (optional)
        </label>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. June content — week 2"
          className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
        />
      </div>

      {posts.map((post, idx) => (
        <PostEditor
          key={post.id}
          post={post}
          index={idx}
          canRemove={posts.length > 1}
          onChange={(patch) => updatePost(post.id, patch)}
          onRemove={() => removePost(post.id)}
        />
      ))}

      <button
        type="button"
        onClick={() => setPosts((prev) => [...prev, emptyPost()])}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-white px-4 py-3 text-sm font-semibold text-brand-600 transition hover:border-accent-500 hover:text-accent-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add another post
      </button>

      {/* Submit bar */}
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pb-4 pt-2">
        {status.state === 'error' && (
          <p className="mb-2 rounded-lg bg-accent-50 px-3 py-2 text-center text-sm text-accent-700 ring-1 ring-accent-200">
            {status.message}
          </p>
        )}
        {!everyPostHasMedia && (
          <p className="mb-2 text-center text-xs text-brand-400">
            Every post needs at least one photo or video.
          </p>
        )}
        {status.state === 'uploading' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs font-medium text-brand-600">
              <span>Uploading & publishing…</span>
              <span>{status.progress}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-200">
              <div
                className="h-full rounded-full bg-accent-600 transition-[width] duration-200"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 px-6 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-accent-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-200 disabled:text-brand-400 disabled:shadow-none"
        >
          {status.state === 'uploading'
            ? 'Publishing…'
            : `Create review & get link${totalFiles > 0 ? ` (${totalFiles} file${totalFiles === 1 ? '' : 's'})` : ''}`}
        </button>
      </div>
    </form>
  );
}
