# Serving the client review pages under your main site

By default this app lives on its own Netlify URL (e.g.
`your-approval-app.netlify.app`). You can make the **client-facing review
links** appear on your main apex domain instead — so clients get
`https://rhythmproductions.ca/review/<token>` rather than a subdomain —
without merging the two sites.

Your main `rhythmproductions.ca` site (a separate Netlify site) simply
**proxies** three namespaced paths to this app. Everything else on your
marketing site is untouched.

## 1. Configure this approval app

In this app's Netlify site → **Site settings → Environment variables**,
add:

| Variable | Value | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_ASSET_BASE` | this app's own URL, e.g. `https://your-approval-app.netlify.app` | Bundled JS/CSS + the logo load from here, not the proxying site |
| `NEXT_PUBLIC_REVIEW_BASE_URL` | your public domain, e.g. `https://rhythmproductions.ca` | The shareable link an admin copies points at the apex domain |

Then trigger a redeploy of this app (these are build-time values).

> Note: leave the **upload portal and `/admin`** on this app's own URL —
> they don't need to be proxied, and admin stays password-protected here.

## 2. Add three rewrites to your MAIN site

On the `rhythmproductions.ca` Netlify site, add the following to its
`netlify.toml` (or the equivalent `_redirects` rules). Replace
`your-approval-app.netlify.app` with this app's real URL.

```toml
# Proxy the Rhythm Productions client-approval pages onto the main domain.
[[redirects]]
  from = "/review/*"
  to = "https://your-approval-app.netlify.app/review/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/review/*"
  to = "https://your-approval-app.netlify.app/api/review/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/review-media/*"
  to = "https://your-approval-app.netlify.app/api/review-media/:splat"
  status = 200
  force = true
```

Equivalent `_redirects` syntax:

```
/review/*            https://your-approval-app.netlify.app/review/:splat            200!
/api/review/*        https://your-approval-app.netlify.app/api/review/:splat        200!
/api/review-media/*  https://your-approval-app.netlify.app/api/review-media/:splat  200!
```

`status = 200` (the `!` / `force`) makes these **proxy rewrites**: the URL
stays `rhythmproductions.ca/review/...` in the client's browser while the
content is served from this app.

## Why only these three paths?

- `/review/*` — the client review pages.
- `/api/review/*` — recording approve / request-changes decisions.
- `/api/review-media/*` — streaming the post photos & videos.

All three are uniquely namespaced, so they won't collide with your
marketing site's own pages or assets. The app's bundled `_next/*` assets
and logo are served from this app's own URL via `NEXT_PUBLIC_ASSET_BASE`,
so there's nothing else to proxy.

## Checklist

1. Set the two env vars on the approval app, redeploy it.
2. Add the three rewrites to the main site, deploy it.
3. Visit `https://rhythmproductions.ca/review/<token>` for any published
   review — it should render with the logo, media, and working Approve /
   Request changes buttons.
