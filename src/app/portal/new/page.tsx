import { cookies } from 'next/headers';
import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { AdminLoginForm } from '@/components/AdminLoginForm';
import { ReviewBuilder } from '@/components/ReviewBuilder';
import { ADMIN_COOKIE_NAME, isAdminCookieValid, getAdminPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function NewReviewPage() {
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

  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="New approval review" />
      <div className="mx-4 mb-4">
        <Link
          href="/portal"
          className="text-xs font-medium text-brand-500 transition hover:text-accent-600"
        >
          ← All reviews
        </Link>
      </div>
      <ReviewBuilder />
    </main>
  );
}
