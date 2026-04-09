'use client';

import { useState } from 'react';

export function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('password', password);
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Sign-in failed.');
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
        Admin password
      </label>
      <input
        type="password"
        required
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none"
      />
      {error && (
        <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700 ring-1 ring-accent-200">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="mt-2 rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:text-brand-400 disabled:shadow-none"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export function AdminSignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/admin/login', { method: 'DELETE' });
        window.location.reload();
      }}
      className="rounded-full border border-brand-300 px-3 py-1 text-xs font-medium text-brand-600 transition hover:border-accent-500 hover:text-accent-600 disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
