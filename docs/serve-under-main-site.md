# Serving the app under your main site (rhythmproductions.ca)

By default this app lives on its own Netlify URL. To serve it under your
main apex domain — so you get clean, secure paths like:

- `https://rhythmproductions.ca/upload` — the client upload page (code-gated)
- `https://rhythmproductions.ca/portal` — your approval admin panel
- `https://rhythmproductions.ca/admin` — the client-uploads dashboard
- `https://rhythmproductions.ca/review/<token>` — the client approval page

…your main `rhythmproductions.ca` site (a separate, git-connected Netlify
site) **proxies** a handful of paths to this app. Visitors only ever see
`rhythmproductions.ca`, which has a valid certificate — so any "Not secure"
warning from the app's own subdomain never reaches them.

Everything — pages, the bundled `_next/*` JS/CSS, and the `/rp/*` brand
assets (logo, favicon) — is proxied through the main site, so nothing loads
cross-origin from this app's own Netlify URL (which a browser may not be
able to reach directly).

## 1. Configure this app (already done for rp-client-upload)

In this app's Netlify site → **Site configuration → Environment variables**:

| Variable | Value | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_REVIEW_BASE_URL` | `https://rhythmproductions.ca` | Generated links (share link, email dashboard links) point at the apex domain |
| `UPLOAD_ACCESS_CODE` | e.g. `456` | The code clients must enter on `/upload` (change anytime) |

> There is no asset-base / `assetPrefix` setting — assets are served
> same-origin through the proxy (see the `/_next/*` and `/rp/*` rules below).

## 2. Add the proxy rules to your MAIN site

On the `rhythmproductions.ca` Netlify site's repo (`rhythm-landing`),
the full `netlify.toml` should read as follows. **Order matters**: the
proxy rules must stay ABOVE the SPA catch-all, or it shadows them.

```toml
[build]
  publish = "."

# ── Proxy the Rhythm Productions client app onto the apex domain ──
# These MUST stay ABOVE the /* catch-all below, or it shadows them.

[[redirects]]
  from = "/upload"
  to = "https://rp-client-upload.netlify.app/upload"
  status = 200
  force = true

[[redirects]]
  from = "/upload/*"
  to = "https://rp-client-upload.netlify.app/upload/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/portal"
  to = "https://rp-client-upload.netlify.app/portal"
  status = 200
  force = true

[[redirects]]
  from = "/portal/*"
  to = "https://rp-client-upload.netlify.app/portal/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/admin"
  to = "https://rp-client-upload.netlify.app/admin"
  status = 200
  force = true

[[redirects]]
  from = "/admin/*"
  to = "https://rp-client-upload.netlify.app/admin/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/review/*"
  to = "https://rp-client-upload.netlify.app/review/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/*"
  to = "https://rp-client-upload.netlify.app/api/:splat"
  status = 200
  force = true

# Bundled assets + brand assets — served same-origin through the proxy.
[[redirects]]
  from = "/_next/*"
  to = "https://rp-client-upload.netlify.app/_next/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/rp/*"
  to = "https://rp-client-upload.netlify.app/rp/:splat"
  status = 200
  force = true

# ── Landing-site SPA fallback (MUST stay last) ──
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

`status = 200` makes these **proxy rewrites**: the URL stays
`rhythmproductions.ca/...` in the browser while the content is served from
this app.

### Heads-up on collisions

`/api/*` and `/admin/*` are generic. `/_next/*` and `/rp/*` are
app-specific and won't collide. If your marketing site already uses
`/api`, `/admin`, `/upload` or `/portal` for its own pages, tell me and
we'll namespace around it.

## 3. Test

After both sites have redeployed:

1. `https://rhythmproductions.ca/upload` → asks for the access code, then
   shows the upload form — **fully styled, with the logo**.
2. `https://rhythmproductions.ca/portal` → asks for the admin password,
   then shows the approval dashboard.
3. Create a review, copy its link (`https://rhythmproductions.ca/review/...`),
   open it, and confirm the media loads and Approve / Request changes work.
