import { cookies } from 'next/headers';
import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { AdminLoginForm, AdminSignOutButton } from '@/components/AdminLoginForm';
import { DeleteButton, DownloadAllButton, FileDownloadButton } from '@/components/AdminActions';
import { listSubmissions } from '@/lib/db';
import { ADMIN_COOKIE_NAME, isAdminCookieValid, getAdminPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function AdminPage() {
  const cookieStore = cookies();
  const authed = isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  const hasPassword = !!getAdminPassword();

  if (!authed) {
    return (
      <main className="flex flex-1 flex-col">
        <Brand subtitle="Studio access" />
        <div className="mx-4 mb-10 rounded-2xl border border-brand-200 bg-white p-6 shadow-card">
          {!hasPassword ? (
            <p className="text-sm text-accent-700">
              The server is missing <code className="rounded bg-brand-100 px-1 text-brand-700">ADMIN_PASSWORD</code>.
              Set it in your environment before using the admin page.
            </p>
          ) : (
            <AdminLoginForm />
          )}
        </div>
      </main>
    );
  }

  const submissions = await listSubmissions();

  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="Client submissions" />

      <div className="mx-4 mb-4 flex items-center justify-between">
        <p className="text-sm text-brand-500">
          {submissions.length} submission{submissions.length === 1 ? '' : 's'}
        </p>
        <AdminSignOutButton />
      </div>

      <div className="mx-4 mb-10 flex flex-col gap-4">
        {submissions.length === 0 && (
          <div className="rounded-2xl border border-brand-200 bg-white p-6 text-center text-sm text-brand-500 shadow-card">
            No submissions yet.
          </div>
        )}

        {submissions.map((s) => {
          const totalBytes = s.files.reduce((a, f) => a + f.size, 0);
          const imageCount = s.files.filter((f) => f.kind === 'image').length;
          const videoCount = s.files.filter((f) => f.kind === 'video').length;

          return (
            <article
              key={s.id}
              className="rounded-2xl border border-brand-200 bg-white shadow-card overflow-hidden"
            >
              {/* Header */}
              <div className="border-b border-brand-100 bg-brand-50/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-brand-900">
                      {s.title || 'Untitled submission'}
                    </h2>
                    <p className="text-xs text-brand-500">
                      {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-brand-500 shrink-0">
                    <p className="font-semibold text-brand-800">{s.clientName}</p>
                    {s.clientEmail && (
                      <a
                        href={`mailto:${s.clientEmail}`}
                        className="text-accent-600 underline-offset-2 hover:underline"
                      >
                        {s.clientEmail}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {s.description && (
                <div className="border-b border-brand-100 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm text-brand-700">
                    {s.description}
                  </p>
                </div>
              )}

              {/* Media grid */}
              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {s.files.map((f) => {
                    const url = `/api/media/${s.id}/${encodeURIComponent(f.storedName)}`;
                    return (
                      <Link
                        key={f.storedName}
                        href={url}
                        target="_blank"
                        className="group relative aspect-square overflow-hidden rounded-lg bg-brand-100 ring-1 ring-brand-200 transition hover:ring-accent-400"
                        title={`${f.originalName} · ${formatBytes(f.size)}`}
                      >
                        {f.kind === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={f.originalName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="relative flex h-full w-full items-center justify-center bg-brand-800">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
                              <svg className="ml-0.5 h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                              {formatBytes(f.size)}
                            </span>
                          </div>
                        )}
                        <FileDownloadButton submissionId={s.id} storedName={f.storedName} />
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Footer with stats + actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 bg-brand-50/30 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-400">
                  {imageCount > 0 && `${imageCount} photo${imageCount === 1 ? '' : 's'}`}
                  {imageCount > 0 && videoCount > 0 && ', '}
                  {videoCount > 0 && `${videoCount} video${videoCount === 1 ? '' : 's'}`}
                  {' · '}
                  {formatBytes(totalBytes)}
                </p>
                <div className="flex gap-2">
                  <DownloadAllButton
                    submissionId={s.id}
                    fileNames={s.files.map((f) => f.storedName)}
                  />
                  <DeleteButton submissionId={s.id} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
