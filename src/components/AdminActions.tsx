'use client';

import { useState } from 'react';

/**
 * Delete button for a submission. Asks for confirmation, then calls
 * DELETE /api/submissions/[id] and reloads the page.
 */
export function DeleteButton({ submissionId }: { submissionId: string }) {
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this submission and all its files? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Delete failed.');
      }
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleDelete}
      className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}

/**
 * Download all files. Uses hidden iframes to trigger multiple
 * simultaneous browser downloads without navigating away.
 */
export function DownloadAllButton({
  submissionId,
  fileNames,
}: {
  submissionId: string;
  fileNames: string[];
}) {
  const [busy, setBusy] = useState(false);

  const handleDownloadAll = async () => {
    setBusy(true);
    try {
      for (const name of fileNames) {
        const url = `/api/media/${submissionId}/${encodeURIComponent(name)}?download=1`;
        // Use a hidden iframe to trigger the download without navigating.
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        // Stagger downloads slightly so the browser handles each one.
        await new Promise((r) => setTimeout(r, 500));
      }
      // Clean up iframes after a delay.
      setTimeout(() => {
        document.querySelectorAll('iframe[style*="display: none"]').forEach((el) => {
          el.remove();
        });
      }, 10000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleDownloadAll}
      className="flex items-center gap-1.5 rounded-full border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      {busy ? 'Downloading…' : `Download all (${fileNames.length})`}
    </button>
  );
}

/**
 * Single file download button — shown as an overlay on each thumbnail.
 */
export function FileDownloadButton({
  submissionId,
  storedName,
}: {
  submissionId: string;
  storedName: string;
}) {
  return (
    <a
      href={`/api/media/${submissionId}/${encodeURIComponent(storedName)}?download=1`}
      className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-brand-700 shadow-sm ring-1 ring-black/10 transition hover:bg-white"
      title="Download"
      onClick={(e) => e.stopPropagation()}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
    </a>
  );
}
