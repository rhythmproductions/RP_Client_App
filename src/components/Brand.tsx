export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex flex-col items-center gap-2 px-6 pt-10 pb-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 shadow-soft ring-1 ring-brand-300/20">
        <svg
          viewBox="0 0 64 64"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden
        >
          <path
            d="M8 40 Q 18 20, 28 40 T 48 40 T 60 40"
            className="text-brand-300"
          />
        </svg>
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-wide text-brand-50">
        Rhythm Productions
      </h1>
      {subtitle && (
        <p className="text-sm text-brand-200/80">{subtitle}</p>
      )}
    </header>
  );
}
