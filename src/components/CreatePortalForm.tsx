'use client';

import { useState } from 'react';
import type { DisplayMode } from '@/lib/reviews';

/**
 * Lightweight "new approval review" form: collect the client details and
 * pick the portal mode (one-at-a-time feed vs calendar), create an empty
 * portal, then drop the admin into the editor to add content.
 */
export function CreatePortalForm() {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [mode, setMode] = useState<DisplayMode>('feed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = clientName.trim().length > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          projectName: projectName.trim(),
          displayMode: mode,
        }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not create portal.');
      }
      const { token } = (await res.json()) as { token: string };
      // Straight into the editor to add content (feed list or calendar grid).
      window.location.href = `/portal/${token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
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
          autoFocus
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
          placeholder="e.g. June content"
          className="mt-1 w-full border-0 border-b border-brand-200 bg-transparent py-2 text-base text-brand-900 placeholder:text-brand-400 focus:border-accent-600 focus:outline-none focus:ring-0"
        />
      </div>

      {/* Mode */}
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-500">
          How should this portal look?
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            { value: 'feed', title: 'One at a time', sub: 'A simple list of posts the client scrolls through.' },
            { value: 'calendar', title: 'Calendar', sub: 'Schedule posts onto days; client sees them by week.' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`rounded-xl border p-3 text-left transition ${
                mode === opt.value
                  ? 'border-accent-500 bg-accent-50'
                  : 'border-brand-200 bg-white hover:border-brand-300'
              }`}
            >
              <span className={`block text-sm font-semibold ${mode === opt.value ? 'text-accent-700' : 'text-brand-800'}`}>
                {opt.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-brand-500">{opt.sub}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-brand-400">
          You can switch this anytime from inside the portal.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-accent-50 px-3 py-2 text-center text-sm text-accent-700 ring-1 ring-accent-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 px-6 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-accent-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-200 disabled:text-brand-400 disabled:shadow-none"
      >
        {busy ? 'Creating…' : 'Create portal & add content'}
      </button>
    </form>
  );
}
