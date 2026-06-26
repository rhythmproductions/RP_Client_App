import { cookies } from 'next/headers';
import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { AdminLoginForm, AdminSignOutButton } from '@/components/AdminLoginForm';
import {
  CopyLinkButton,
  OpenLinkButton,
  DeleteReviewButton,
} from '@/components/ReviewAdminActions';
import { listReviews, type PostType } from '@/lib/reviews';
import { ADMIN_COOKIE_NAME, isAdminCookieValid, getAdminPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const POST_TYPE_LABEL: Record<PostType, string> = {
  single: 'Single photo',
  carousel: 'Carousel',
  reel: 'Reel',
  video: 'Video',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function ReviewsAdminPage() {
  const authed = isAdminCookieValid(cookies().get(ADMIN_COOKIE_NAME)?.value);
  const hasPassword = !!getAdminPassword();

  if (!authed) {
    return (
      <main className="flex flex-1 flex-col">
        <Brand subtitle="Studio access" />
        <div className="mx-4 mb-10 rounded-2xl border border-brand-200 bg-white p-6 shadow-card">
          {!hasPassword ? (
            <p className="text-sm text-accent-700">
              The server is missing{' '}
              <code className="rounded bg-brand-100 px-1 text-brand-700">ADMIN_PASSWORD</code>.
            </p>
          ) : (
            <AdminLoginForm />
          )}
        </div>
      </main>
    );
  }

  const reviews = await listReviews();

  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="Client approvals" />

      <div className="mx-4 mb-4 flex items-center justify-between">
        <p className="text-sm text-brand-500">
          {reviews.length} review{reviews.length === 1 ? '' : 's'}
        </p>
        <AdminSignOutButton />
      </div>

      <div className="mx-4 mb-4">
        <Link
          href="/portal/new"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-500"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New approval review
        </Link>
      </div>

      <div className="mx-4 mb-10 flex flex-col gap-4">
        {reviews.length === 0 && (
          <div className="rounded-2xl border border-brand-200 bg-white p-6 text-center text-sm text-brand-500 shadow-card">
            No reviews yet. Create one to send your client a private approval link.
          </div>
        )}

        {reviews.map((r) => {
          const approved = r.posts.filter((p) => p.decision === 'approved').length;
          const changes = r.posts.filter((p) => p.decision === 'changes_requested').length;
          const pending = r.posts.filter((p) => p.decision === 'pending').length;
          const allDone = r.posts.length > 0 && pending === 0;

          return (
            <article
              key={r.token}
              className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-card"
            >
              {/* Header */}
              <div className="border-b border-brand-100 bg-brand-50/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-brand-900">
                      {r.projectName || 'Untitled review'}
                    </h2>
                    <p className="text-xs text-brand-500">{formatDate(r.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-brand-500">
                    <p className="font-semibold text-brand-800">{r.clientName}</p>
                    {r.clientEmail && (
                      <a
                        href={`mailto:${r.clientEmail}`}
                        className="text-accent-600 underline-offset-2 hover:underline"
                      >
                        {r.clientEmail}
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700 ring-1 ring-green-200">
                    {approved} approved
                  </span>
                  <span className="rounded-full bg-accent-50 px-2 py-0.5 text-accent-700 ring-1 ring-accent-200">
                    {changes} changes
                  </span>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-600">
                    {pending} pending
                  </span>
                  {allDone && (
                    <span className="rounded-full bg-green-600 px-2 py-0.5 text-white">
                      Complete
                    </span>
                  )}
                </div>
              </div>

              {/* Posts */}
              <ul className="divide-y divide-brand-100">
                {r.posts.map((p, i) => (
                  <li key={p.id} className="flex gap-3 px-4 py-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-brand-900 ring-1 ring-brand-200">
                      {p.media[0]?.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/review-media/${r.token}/${encodeURIComponent(p.media[0].storedName)}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <svg className="h-5 w-5 text-white/80" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      )}
                      {p.media.length > 1 && (
                        <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                          {p.media.length}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-500">
                          {i + 1}. {POST_TYPE_LABEL[p.type]}
                        </span>
                        {p.decision === 'approved' && (
                          <span className="text-xs font-semibold text-green-600">Approved</span>
                        )}
                        {p.decision === 'changes_requested' && (
                          <span className="text-xs font-semibold text-accent-600">Changes</span>
                        )}
                        {p.decision === 'pending' && (
                          <span className="text-xs font-medium text-brand-400">Pending</span>
                        )}
                      </div>
                      {p.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs italic text-brand-500">
                          {p.description}
                        </p>
                      )}
                      {p.caption && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-brand-600">
                          {p.caption}
                        </p>
                      )}
                      {p.decision === 'changes_requested' && p.changeRequest && (
                        <p className="mt-1 whitespace-pre-wrap rounded-md bg-accent-50 px-2 py-1 text-xs text-brand-800 ring-1 ring-accent-100">
                          {p.changeRequest}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 bg-brand-50/30 px-4 py-3">
                <Link
                  href={`/portal/${r.token}`}
                  className="flex items-center gap-1.5 rounded-full bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white shadow-soft transition hover:bg-accent-500"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
                  </svg>
                  Edit posts
                </Link>
                <CopyLinkButton token={r.token} />
                <OpenLinkButton token={r.token} />
                <div className="ml-auto">
                  <DeleteReviewButton token={r.token} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
