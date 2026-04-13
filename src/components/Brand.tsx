/**
 * Logo rendered with web fonts for a close match to the
 * Rhythm Productions wordmark. To swap in your actual logo image,
 * replace this component's content with:
 *   <img src="/logo.png" alt="Rhythm Productions" className="h-20 w-auto" />
 * and save your file to public/logo.png.
 */
export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex flex-col items-center gap-1 px-6 pt-10 pb-6 text-center">
      <div className="flex flex-col items-center leading-none select-none">
        <span
          className="text-[3.2rem] font-bold tracking-tight text-accent-600"
          style={{
            fontFamily: "'Oswald', 'Impact', 'Arial Black', sans-serif",
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
          }}
        >
          RHYTHM
        </span>
        <span
          className="mt-1 text-[0.85rem] font-medium text-brand-500"
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            letterSpacing: '0.35em',
          }}
        >
          PRODUCTIONS
        </span>
      </div>
      {subtitle && (
        <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-brand-500">
          {subtitle}
        </p>
      )}
    </header>
  );
}
