/**
 * The logo is loaded from `/public/logo.svg`. To swap in your real
 * high-resolution logo file, drop it at `public/logo.svg` (or
 * `public/logo.png` and change the src below) — no code changes
 * otherwise required.
 */
export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex flex-col items-center gap-3 px-6 pt-10 pb-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt="Rhythm Productions"
        className="h-20 w-auto max-w-[280px] select-none"
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
