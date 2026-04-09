import { Brand } from '@/components/Brand';
import { UploadForm } from '@/components/UploadForm';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="Send us your photos & videos" />
      <UploadForm />
      <footer className="mt-auto px-6 pb-4 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-brand-400">
        &copy; Rhythm Productions
      </footer>
    </main>
  );
}
