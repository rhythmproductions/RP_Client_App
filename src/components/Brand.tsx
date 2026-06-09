import { asset } from '@/lib/site';

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex flex-col items-center gap-3 px-6 pt-10 pb-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset('/logo.png')}
        alt="Rhythm Productions"
        className="h-auto w-full max-w-[260px] select-none"
        draggable={false}
      />
      {subtitle && (
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-500">
          {subtitle}
        </p>
      )}
    </header>
  );
}
