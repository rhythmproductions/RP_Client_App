# Rhythm Productions — Client Upload App

A mobile-first Progressive Web App (PWA) that lets your clients send you
photos and videos directly from their phones. They visit a URL, tap "Add to
Home Screen" (iOS) or "Install app" (Android), and it behaves like a native
app — no App Store, no Play Store.

## Features

- Mobile-first, professional interface in the Rhythm Productions
  red / white / grey brand palette
- Multi-select photos **and** videos from the phone's native picker
- Instant preview grid — photos render directly, videos get a first-frame
  thumbnail generated on-device
- Title + description fields for context
- Client name + optional email so you know who sent what
- Real upload progress bar
- Files saved to disk, metadata in a lightweight JSON database
- Password-protected `/admin` page to review all submissions
- PWA manifest + icons so clients can install it to their home screen

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- File storage on the local filesystem (`data/uploads/`)
- JSON database (`data/db.json`) — zero setup, easy to back up

## Getting started (local)

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env.local
# then edit .env.local and set ADMIN_PASSWORD to something strong

# 3. Run the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) on your computer, or
from your phone on the same Wi-Fi network at
`http://<your-computer-ip>:3000`.

The admin page lives at [http://localhost:3000/admin](http://localhost:3000/admin).

## Project structure

```
src/
  app/
    layout.tsx              # Root layout, PWA metadata, fonts
    page.tsx                # Landing / upload page
    globals.css             # Tailwind + small helpers
    admin/
      page.tsx              # Password-protected submissions viewer
    api/
      upload/route.ts       # POST /api/upload — saves files + metadata
      media/[id]/[name]/    # GET  /api/media/... — serves stored media (auth)
      admin/login/route.ts  # POST/DELETE — admin session cookie
  components/
    Brand.tsx
    UploadForm.tsx          # Upload UI with preview grid + video thumbnails
    AdminLoginForm.tsx
  lib/
    db.ts                   # JSON database helpers
    auth.ts                 # Admin cookie helpers
public/
  manifest.json             # PWA manifest
  logo.svg                  # Header logo — replace with your own anytime
  icon-192.svg / icon-512.svg  # PWA / home-screen icons
data/                       # Created at runtime (gitignored)
  uploads/
  db.json
```

## Deploying

Any Node host that can run a Next.js app will work:

- **Vercel** (simplest): click "Import Project", set the `ADMIN_PASSWORD`
  environment variable. **Note:** Vercel's serverless filesystem is ephemeral,
  so uploaded files will not persist across deploys. For production use on
  Vercel, swap `src/lib/db.ts` and the upload route to write to S3 /
  Cloudflare R2 / Supabase Storage.
- **Railway / Render / Fly.io**: attach a persistent volume mounted at
  `/data`, then set `DATA_DIR=/data` and `ADMIN_PASSWORD=...`.
- **Your own VPS**: `npm run build && npm start` behind Nginx with HTTPS.

PWAs require HTTPS in production — `localhost` is exempt during development.

## Installing on a client's phone

1. Send them the URL.
2. **iOS Safari:** tap the Share icon → "Add to Home Screen."
3. **Android Chrome:** tap the menu (⋮) → "Install app" (or "Add to Home
   screen"). Chrome will also prompt automatically after a few visits.

The app then launches full-screen with its own icon, just like a native app.

## Security notes

- Upload endpoint is **unauthenticated** by design — anyone with the URL can
  send you files. This matches the "client sends me stuff" use case. Add a
  per-client token to `src/app/api/upload/route.ts` if you want to restrict
  it.
- Admin endpoints and media viewing are protected by a single shared
  password set via `ADMIN_PASSWORD`. The password is stored in an
  `httpOnly`, `sameSite=lax` cookie for 8 hours.
- Max 50 files / 500 MB per submission. Adjust `MAX_FILES` and
  `MAX_TOTAL_BYTES` in `src/app/api/upload/route.ts`.

## Swapping in your real logo

The header logo is loaded from `public/logo.svg`. To use the actual
high-resolution Rhythm Productions wordmark:

1. Save it as `public/logo.svg` (same filename, any size — it scales).
2. Or save as `public/logo.png` and change the `src` in
   `src/components/Brand.tsx` to `/logo.png`.

The home-screen / PWA icons are `public/icon-192.svg` and
`public/icon-512.svg`. Replace those with square versions of the mark if
you have them.

Brand colors live in `tailwind.config.ts`:

- `accent-600` — logo red (`#d9232b`)
- `brand-500`/`brand-600` — logo grey (used for secondary text)
- `brand-50`…`brand-200` — light surfaces (backgrounds, cards, borders)

## Client deliverable approval system

Alongside the upload portal, the app includes an **approval system** for
sending finished social posts to clients for sign-off.

### How it works

1. **You** go to `/portal` → **New approval review**.
2. Add one or more posts. Each post has a **type** (single photo,
   multi-photo carousel, reel, or video), its **media**, a **description**
   (your note to the client), and the **post copy / caption** the client is
   approving.
3. Hit **Create review & get link**. Media uploads directly to Google
   Drive (same resumable flow as the upload portal — big videos are fine),
   and you get a **private link** like
   `https://rhythmproductions.ca/review/<token>`.
4. Send that link to your client. The token is an unguessable secret — no
   login or passcode, anyone with the link can open it (and only them).
5. On the review page the client sees each post with its caption and taps
   **Approve** or **Request changes** (which opens a note box). Every
   decision saves instantly.
6. **You** get an email (to `info@rhythmproductions.ca`) on each decision,
   and can watch live status at `/portal`.

Each portal is a **living page** for that client: from `/portal/<token>`
you can add posts over time, **edit** a post's media/description/caption,
and delete posts. Editing a post the client flagged sends it back to them
as *pending* for re-approval — so you can go back and forth until it's
approved. A portal can be shown in two modes (toggle at the top of the
editor):

- **One-at-a-time (feed)** — a simple vertical list of posts.
- **Calendar** — schedule posts onto days; the client sees only the days
  you filled, grouped by week (Monday start).

### Routes

```
/upload                   # client upload page (gated by UPLOAD_ACCESS_CODE)
/admin                    # client-uploads dashboard
/portal                   # approval portals — list + live status
/portal/new               # create a new client portal
/portal/<token>           # manage a portal: add / edit / schedule / delete posts
/review/<token>           # the private client-facing approval page
```

The approval system reuses `ADMIN_PASSWORD` (for `/portal`), the Google
Drive storage, and Resend (for decision emails). Review metadata lives in
its own Netlify Blobs store (`reviews`), separate from uploads.

### Serving everything under your main domain

To serve `/upload`, `/portal` and `/review/...` from your apex domain
(`https://rhythmproductions.ca/...`) instead of a subdomain — which also
clears any subdomain certificate warnings — proxy a few paths from your
main Netlify site to this app. See
**[docs/serve-under-main-site.md](docs/serve-under-main-site.md)** for the
exact rewrite rules (pages, `_next/*` and `/rp/*` assets, all proxied
same-origin) and the env vars (`NEXT_PUBLIC_REVIEW_BASE_URL`,
`UPLOAD_ACCESS_CODE`).

## Ideas for v2

- Swap disk storage for S3-compatible object storage
- Per-client upload links (`/upload/<token>`) instead of a single open form
- Email notification on new submission (SendGrid, Resend, etc.)
- Download-all as zip from the admin page
- EXIF stripping on upload for privacy
- Offline upload queue via a service worker
