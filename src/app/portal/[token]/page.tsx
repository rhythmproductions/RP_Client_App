import { cookies } from 'next/headers';
import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { AdminLoginForm } from '@/components/AdminLoginForm';
import { PortalEditor } from '@/components/PortalEditor';
import { CopyLinkButton, OpenLinkButton } from '@/components/ReviewAdminActions';
import { findReview } from '@/lib/reviews';
import { ADMIN_COOKIE_NAME, isAdminCookieValid, getAdminPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PortalReviewPage({
  params,
}: {
  params: { token: string };
}) {
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

  const review = await findReview(params.token);
  if (!review) {
    return (
      <main className="flex flex-1 flex-col">
        <Brand subtitle="Client portal" />
        <div className="mx-4 mb-10 rounded-2xl border border-brand-200 bg-white p-6 text-center text-sm text-brand-500 shadow-card">
          That portal could not be found.{' '}
          <Link href="/portal" className="text-accent-600 underline-offset-2 hover:underline">
            Back to all portals
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="Client portal" />

      <div className="mx-4 mb-3 flex items-center justify-between">
        <Link href="/portal" className="text-xs font-medium text-brand-500 transition hover:text-accent-600">
          ← All portals
        </Link>
      </div>

      <div className="mx-4 mb-4 rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
        <h1 className="text-lg font-semibold text-brand-900">
          {review.projectName || review.clientName}
        </h1>
        <p className="text-xs text-brand-500">{review.clientName}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyLinkButton token={review.token} />
          <OpenLinkButton token={review.token} />
        </div>
      </div>

      <PortalEditor
        token={review.token}
        clientName={review.clientName}
        initialMode={review.displayMode ?? 'feed'}
        posts={review.posts}
      />
    </main>
  );
}
