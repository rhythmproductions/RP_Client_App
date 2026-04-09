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
      <label className="text-xs font-medium uppercase tracking-wider text-brand-200/70">
        Admin password
      </label>
      <input
        type="password"
        required
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-brand-300/20 bg-brand-950/40 px-3 py-2 text-base text-brand-50 placeholder:text-brand-200/40 focus:border-brand-300 focus:outline-none"
      />
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/30">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="mt-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-50 shadow-soft transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-brand-800 disabled:text-brand-300/50"
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
      className="rounded-full border border-brand-300/20 px-3 py-1 text-xs text-brand-200 transition hover:border-brand-300/60 disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
