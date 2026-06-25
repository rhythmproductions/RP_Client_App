/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Assets are served same-origin. When this app is proxied behind another
  // domain (rhythmproductions.ca), the `_next/*` bundles and `/rp/*` brand
  // assets are proxied alongside the pages — see docs/serve-under-main-site.md
  // — so nothing loads cross-origin from this app's own Netlify URL.
};

module.exports = nextConfig;
