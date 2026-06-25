'use client';

import { useState } from 'react';

/**
 * Code entry screen shown on /upload when an access code is required and
 * the visitor doesn't have a valid cookie yet. On success it reloads so
 * the server re-renders the actual upload form.
 */
export function UploadAccessGate() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('code', code);
      const res = await fetch('/api/upload/access', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Incorrect code.');
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-4 mb-10 rounded-2xl border border-brand-200 bg-white p-6 shadow-card">
      <h2 className="text-lg font-semibold text-brand-900">Enter your access code</h2>
      <p className="mt-1 text-sm text-brand-500">
        Rhythm Productions gave you a code to upload your files. Enter it below.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <input
          inputMode="numeric"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 456"
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-center text-lg tracking-[0.3em] text-brand-900 placeholder:tracking-normal placeholder:text-brand-400 focus:border-accent-600 focus:outline-none"
        />
        {error && (
          <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700 ring-1 ring-accent-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || code.trim().length === 0}
          className="rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:text-brand-400 disabled:shadow-none"
        >
          {submitting ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
