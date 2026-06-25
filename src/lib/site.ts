/**
 * Public site configuration for serving the review pages under a
 * different domain than where the app itself is deployed.
 *
 * When this approval app is proxied behind the main marketing site
 * (e.g. rhythmproductions.ca/review/... → this Netlify app), two things
 * must point at absolute URLs so they don't resolve against the main
 * site instead:
 *
 *   1. Static/public assets (the logo, favicon) — handled here via
 *      NEXT_PUBLIC_ASSET_BASE, paired with `assetPrefix` in
 *      next.config.js for the bundled `_next/*` assets.
 *   2. The shareable client link an admin copies — handled by
 *      `reviewUrl()` via NEXT_PUBLIC_REVIEW_BASE_URL, so the link points
 *      at the public apex domain rather than this app's own Netlify URL.
 *
 * Both default to empty / current-origin behaviour, so a single-domain
 * deployment keeps working with no configuration.
 */

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '');

/** Absolute base for /public assets (logo, favicon). Empty when unset. */
export const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE
  ? stripTrailingSlash(process.env.NEXT_PUBLIC_ASSET_BASE)
  : '';

/** Resolve a /public asset path to an absolute URL when proxied. */
export function asset(path: string): string {
  return `${ASSET_BASE}${path}`;
}

/** Build the public client-facing review link for a given token. */
export function reviewUrl(token: string): string {
  const configured = process.env.NEXT_PUBLIC_REVIEW_BASE_URL;
  const base = configured
    ? stripTrailingSlash(configured)
    : typeof window !== 'undefined'
      ? window.location.origin
      : '';
  return `${base}/review/${token}`;
}
