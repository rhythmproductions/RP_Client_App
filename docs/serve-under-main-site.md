# Serving the app under your main site (rhythmproductions.ca)

By default this app lives on its own Netlify URL. To serve it under your
main apex domain — so you get clean, secure paths like:

- `https://rhythmproductions.ca/upload` — the client upload page (code-gated)
- `https://rhythmproductions.ca/portal` — your approval admin panel
- `https://rhythmproductions.ca/admin` — the client-uploads dashboard
- `https://rhythmproductions.ca/review/<token>` — the client approval page

…your main `rhythmproductions.ca` site (a separate, git-connected Netlify
site) **proxies** a handful of paths to this app. Visitors only ever see
`rhythmproductions.ca`, which has a valid certificate — so the "Not secure"
warning from the app's own subdomain never reaches them.

## 1. Configure this app (already done for rp-client-upload)

In this app's Netlify site → **Site configuration → Environment variables**:

| Variable | Value | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_ASSET_BASE` | this app's `*.netlify.app` URL, e.g. `https://rp-client-upload.netlify.app` | Bundled JS/CSS + the logo load from a URL with a valid certificate, not the proxying site |
| `NEXT_PUBLIC_REVIEW_BASE_URL` | `https://rhythmproductions.ca` | Generated links (share link, email dashboard links) point at the apex domain |
| `UPLOAD_ACCESS_CODE` | e.g. `456` | The code clients must enter on `/upload` (change anytime) |

> Use the `*.netlify.app` URL (always valid SSL) as the proxy target and
> asset base — not a custom subdomain whose certificate may be unprovisioned.

## 2. Add the proxy rules to your MAIN site

On the `rhythmproductions.ca` Netlify site's repo, add this to a
`netlify.toml` at the repo root (append the `[[redirects]]` blocks if the
file already exists), then push to its production branch (`master`):

```toml
# Proxy the Rhythm Productions client app onto the main domain.
# Order matters: keep these ABOVE any catch-all/SPA redirect.

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
  from = "/portal/*"
  to = "https://rp-client-upload.netlify.app/portal/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/portal"
  to = "https://rp-client-upload.netlify.app/portal"
  status = 200
  force = true

[[redirects]]
  from = "/admin/*"
  to = "https://rp-client-upload.netlify.app/admin/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/admin"
  to = "https://rp-client-upload.netlify.app/admin"
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
```

`status = 200` makes these **proxy rewrites**: the URL stays
`rhythmproductions.ca/...` in the browser while the content is served from
this app. The app's bundled `_next/*` assets load directly from
`NEXT_PUBLIC_ASSET_BASE`, so they don't need a proxy rule.

### Heads-up on collisions

`/api/*` and `/admin/*` are generic. If your marketing site already uses
either path for its own pages or functions, tell me and we'll namespace
around it. A typical static marketing site doesn't, so this is usually safe.

## 3. Test

After both sites have redeployed:

1. `https://rhythmproductions.ca/upload` → should ask for the access code,
   then show the upload form.
2. `https://rhythmproductions.ca/portal` → should ask for the admin
   password, then show the approval dashboard.
3. Create a review, copy its link (`https://rhythmproductions.ca/review/...`),
   open it, and confirm the media loads and Approve / Request changes work.
