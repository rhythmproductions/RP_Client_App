/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // When the app is proxied behind another domain (e.g. the review pages
  // served at rhythmproductions.ca/review/...), bundled assets must load
  // from this app's own URL rather than the proxying site. Set
  // NEXT_PUBLIC_ASSET_BASE to this Netlify site's URL to enable that.
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_BASE || undefined,
};

module.exports = nextConfig;
