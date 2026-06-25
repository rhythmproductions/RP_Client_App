import { cookies } from 'next/headers';
import { Brand } from '@/components/Brand';
import { UploadForm } from '@/components/UploadForm';
import { UploadAccessGate } from '@/components/UploadAccessGate';
import { UPLOAD_COOKIE, isUploadAccessValid } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function UploadPage() {
  const unlocked = isUploadAccessValid(cookies().get(UPLOAD_COOKIE)?.value);

  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="Send us your photos & videos" />
      {unlocked ? <UploadForm /> : <UploadAccessGate />}
      <footer className="mt-auto px-6 pb-4 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-brand-400">
        &copy; Rhythm Productions
      </footer>
    </main>
  );
}
