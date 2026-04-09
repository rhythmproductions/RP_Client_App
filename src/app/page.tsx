import { Brand } from '@/components/Brand';
import { UploadForm } from '@/components/UploadForm';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Brand subtitle="Send us your photos & videos" />
      <UploadForm />
      <footer className="mt-auto px-6 pb-4 text-center text-[11px] uppercase tracking-widest text-brand-300/40">
        Rhythm Productions
      </footer>
    </main>
  );
}
