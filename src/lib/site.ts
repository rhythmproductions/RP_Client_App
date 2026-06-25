/**
 * Public site configuration for serving the app under a different domain
 * than where it is deployed (e.g. rhythmproductions.ca proxies /upload,
 * /portal and /review/... to this Netlify app).
 *
 * Assets are served SAME-ORIGIN through the proxy: bundled `_next/*` files
 * and the namespaced `/rp/*` brand assets are proxied alongside the pages,
 * so nothing loads cross-origin from this app's own (browser-unreachable)
 * Netlify URL. The only thing that needs an absolute URL is the shareable
 * client link an admin copies — `reviewUrl()` points it at the public apex
 * domain via NEXT_PUBLIC_REVIEW_BASE_URL.
 */

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '');

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
