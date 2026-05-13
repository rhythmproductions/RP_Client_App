'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type MediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  kind: 'image' | 'video';
  videoThumbUrl?: string;
  title: string;
  notes: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Generate a thumbnail (data URL) from the first frame of a video file. */
function generateVideoThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
    };

    video.onloadeddata = () => {
      try {
        const seekTo = Math.min(0.1, (video.duration || 1) / 10);
        video.currentTime = seekTo;
      } catch {
        resolve(undefined);
        cleanup();
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        const scale = Math.min(1, 320 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          cleanup();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      } catch {
        resolve(undefined);
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      resolve(undefined);
      cleanup();
    };
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Upload a single file to a Google Drive resumable-upload session URI
 * in one PUT, tracking progress. Returns the Drive fileId.
 */
function uploadFileToDriveSession(
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
          if (!body.id) {
            reject(new Error('Drive did not return a file id.'));
            return;
          }
          resolve(body.id);
        } catch {
          reject(new Error('Could not parse Drive response.'));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during file upload.'));
    xhr.send(file);
  });
}

type Status =
  | { state: 'idle' }
  | { state: 'uploading'; progress: number }
  | { state: 'success' }
  | { state: 'error'; message: string };

export function UploadForm() {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const incoming: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) continue;
      incoming.push({
        id: uid(),
        file,
        previewUrl: URL.createObjectURL(file),
        kind: isImage ? 'image' : 'video',
        title: '',
        notes: '',
      });
    }
    setItems((prev) => [...prev, ...incoming]);

    for (const item of incoming) {
      if (item.kind === 'video') {
        const thumb = await generateVideoThumbnail(item.file);
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, videoThumbUrl: thumb } : p,
          ),
        );
      }
    }
  }, []);

  const updateItem = (id: string, patch: Partial<MediaItem>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const totalBytes = items.reduce((acc, i) => acc + i.file.size, 0);

  const canSubmit =
    items.length > 0 &&
    clientName.trim().length > 0 &&
    status.state !== 'uploading';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ state: 'uploading', progress: 0 });

    try {
      // ── Phase 1: send metadata, get Drive upload session URIs ──
      const prepareRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          projectName: projectName.trim(),
          files: items.map((i) => ({
            name: i.file.name,
            size: i.file.size,
            type: i.file.type,
            title: i.title.trim(),
            notes: i.notes.trim(),
          })),
        }),
      });

      if (!prepareRes.ok) {
        const body = await prepareRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Prepare failed (${prepareRes.status}).`);
      }

      const { submissionId, uploads } = (await prepareRes.json()) as {
        submissionId: string;
        uploads: { storedName: string; sessionUri: string }[];
      };

      // ── Phase 2: upload files directly to Google Drive ──
      const totalSize = items.reduce((s, i) => s + i.file.size, 0);
      const perFileLoaded = new Array(uploads.length).fill(0);

      const updateOverallProgress = () => {
        const loaded = perFileLoaded.reduce((a, b) => a + b, 0);
        const pct = totalSize > 0 ? Math.round((loaded / totalSize) * 100) : 100;
        setStatus({ state: 'uploading', progress: Math.min(pct, 99) });
      };

      const driveFileIds = await Promise.all(
        uploads.map((u, idx) =>
          uploadFileToDriveSession(items[idx].file, u.sessionUri, (loaded) => {
            perFileLoaded[idx] = loaded;
            updateOverallProgress();
          }),
        ),
      );

      // ── Phase 3: confirm ──
      const confirmRes = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          files: uploads.map((u, idx) => ({
            storedName: u.storedName,
            driveFileId: driveFileIds[idx],
          })),
        }),
      });

      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'Confirmation failed.');
      }

      setStatus({ state: 'success' });
      items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      setItems([]);
      setProjectName('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong.';
      setStatus({ state: 'error', message });
    }
  };

  // ── Success screen ──

  if (status.state === 'success') {
    return (
      <div className="fade-in-up mx-4 mb-8 rounded-2xl border border-brand-200 bg-white p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 ring-1 ring-accent-200">
          <svg
            className="h-7 w-7 text-accent-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-brand-900">Thank you!</h2>
        <p className="mt-2 text-sm text-brand-500">
          Your files have been delivered to Rhythm Productions. We&apos;ll be in
          touch soon.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ state: 'idle' })}
          className="mt-6 rounded-full bg-accent-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500 active:scale-[0.98]"
        >
          Send more
        </button>
      </div>
    );
  }

  // ── Upload form ──

  return (
    <form onSubmit={submit} className="mx-4 mb-10 flex flex-col gap-5">
      {/* Client info */}
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Your name
        </label>
        <input
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Jane Doe"
          className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
        />
        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Email (optional)
        </label>
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="jane@example.com"
          className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
        />
      </div>

      {/* Project name */}
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          Project / Date
        </label>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. Site walkthrough — May 11"
          className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
        />
      </div>

      {/* Media picker */}
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">Your media</h2>
          <span className="text-xs text-brand-500">
            {items.length} file{items.length === 1 ? '' : 's'}
            {items.length > 0 && ` · ${formatBytes(totalBytes)}`}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="visually-hidden"
          onChange={(e) => {
            onPick(e.target.files);
            if (e.target) e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-5 text-sm font-medium text-brand-600 transition hover:border-accent-500 hover:bg-accent-50 hover:text-accent-700 active:scale-[0.99]"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {items.length === 0 ? 'Choose photos & videos' : 'Add more'}
        </button>

        {items.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((item, idx) => (
              <li
                key={item.id}
                className="fade-in-up relative rounded-xl border border-brand-200 bg-brand-50/40 p-3"
              >
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-100 ring-1 ring-brand-200">
                    {item.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        {item.videoThumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.videoThumbUrl}
                            alt={item.file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-brand-400">
                            <svg
                              className="h-6 w-6 animate-pulse"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/40">
                            <svg
                              className="ml-0.5 h-3.5 w-3.5 text-white"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Fields */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[11px] text-brand-500"
                      title={item.file.name}
                    >
                      {idx + 1}. {item.file.name} · {formatBytes(item.file.size)}
                    </p>
                    <input
                      value={item.title}
                      onChange={(e) =>
                        updateItem(item.id, { title: e.target.value })
                      }
                      placeholder="Subject / name / number"
                      className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-1.5 text-sm text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
                    />
                    <textarea
                      value={item.notes}
                      onChange={(e) =>
                        updateItem(item.id, { notes: e.target.value })
                      }
                      rows={2}
                      placeholder="Notes about this file (optional)"
                      className="mt-2 w-full resize-none rounded-md border border-brand-200 bg-white px-2 py-1.5 text-sm text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-600 text-white opacity-90 shadow-soft transition hover:bg-accent-500"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pb-4 pt-2">
        {status.state === 'error' && (
          <p className="mb-2 rounded-lg bg-accent-50 px-3 py-2 text-center text-sm text-accent-700 ring-1 ring-accent-200">
            {status.message}
          </p>
        )}

        {status.state === 'uploading' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs font-medium text-brand-600">
              <span>Uploading…</span>
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
            ? 'Sending…'
            : 'Send to Rhythm Productions'}
        </button>
      </div>
    </form>
  );
}
