import type { Metadata } from 'next';
import { Brand } from '@/components/Brand';
import { ReviewClient } from '@/components/ReviewClient';
import { findReview } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rhythm Productions — Content Approval',
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  params,
}: {
  params: { token: string };
}) {
  const review = await findReview(params.token);

  if (!review || review.status !== 'published') {
    return (
      <main className="flex flex-1 flex-col">
        <Brand subtitle="Content approval" />
        <div className="mx-4 mb-10 rounded-2xl border border-brand-200 bg-white p-6 text-center shadow-card">
          <h2 className="text-lg font-semibold text-brand-900">
            This link isn&apos;t available
          </h2>
          <p className="mt-2 text-sm text-brand-500">
            It may have expired or been removed. Please check the link or get in
            touch with Rhythm Productions.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="Content approval" />
      <ReviewClient
        token={review.token}
        clientName={review.clientName}
        projectName={review.projectName}
        posts={review.posts}
      />
      <footer className="mt-auto px-6 pb-4 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-brand-400">
        &copy; Rhythm Productions
      </footer>
    </main>
  );
}
