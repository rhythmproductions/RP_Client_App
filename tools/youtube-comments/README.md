# YouTube Comment Miner

Download the comments (author, text, likes, date) from **any YouTube video,
channel, or playlist** into a `.csv` file you can open in **Google Sheets,
Google Docs, or Excel** — then hand that file back to Claude to mine for
marketing / copywriting gold.

It uses YouTube's official, free **Data API v3**. You get **10,000 free quota
units per day**, and one comment-page (up to 100 comments) costs **1 unit** —
so you can pull on the order of **a million comments a day** at no cost.

There is **nothing to install**. The script uses only what comes with Node.js,
which this project already requires.

---

## One-time setup (about 5 minutes)

### Step 1 — Get a free YouTube Data API key

1. Go to **https://console.cloud.google.com/** and sign in with your Google
   account.
2. At the top, click the project dropdown → **New Project** → name it anything
   (e.g. "youtube-comments") → **Create**. Wait a few seconds, then make sure
   that new project is selected.
3. In the search bar at the top, type **"YouTube Data API v3"**, open it, and
   click **Enable**.
4. In the left menu go to **APIs & Services → Credentials**.
5. Click **+ Create Credentials → API key**. A key will appear — click
   **Copy**. (You can click "Edit API key" later to restrict it to the YouTube
   Data API, which is good practice but optional.)

> You do **not** need billing, OAuth, or a verification screen for this. A plain
> API key is enough to read public comments.

### Step 2 — Store the key safely (don't paste it into chat)

1. In the project's main folder, find the file named **`.env.local`**
   (create it if it doesn't exist — it sits next to `package.json`).
2. Add this line, pasting your key after the `=`:

   ```
   YOUTUBE_API_KEY=paste-your-key-here
   ```

3. Save the file.

`.env.local` is already listed in `.gitignore`, so your key will **never** be
committed to GitHub or shown in chat. The script reads it straight from that
file.

---

## Step 3 — Run it

Open a terminal **in the project folder** and run one of these.

**A single video:**
```
node tools/youtube-comments/mine-comments.mjs "https://www.youtube.com/watch?v=VIDEO_ID"
```

**A whole channel** (any of these link shapes work):
```
node tools/youtube-comments/mine-comments.mjs "https://www.youtube.com/@SomeChannel"
```

**Don't want to type the link?** Just run it with nothing and paste the link
when it asks:
```
node tools/youtube-comments/mine-comments.mjs
```

When it finishes, it prints the exact location of your `.csv` file (saved in
`tools/youtube-comments/output/`) and how much of your daily quota you used.

### Step 4 — Open the file in Google

1. Go to **drive.google.com**.
2. **New → File upload** → choose the `.csv` the script made.
3. Double-click it → **Open with Google Sheets**. Every comment is now a row
   with columns for author, text, likes, and date.

To open it as a Google **Doc** instead, in Sheets use **File → Download →**
or just copy the `text` column into a Doc.

---

## Rerunning / common options

Run the same command again any time — each run makes a fresh, timestamped file,
so nothing gets overwritten.

| What you want | Add this |
| --- | --- |
| Include replies, not just top-level comments | `--replies` |
| Stop after N comments (good for testing) | `--max 500` |
| Only mine the newest N videos of a channel | `--max-videos 10` |
| Choose where the file is saved | `--out my-file.csv` |

Example — first 1,000 comments of a channel's 5 newest videos, with replies:
```
node tools/youtube-comments/mine-comments.mjs "https://youtube.com/@SomeChannel" --replies --max 1000 --max-videos 5
```

---

## What you get (CSV columns)

`video_id`, `video_title`, `comment_id`, `parent_id`, `is_reply`, `author`,
`author_channel_id`, `likes`, `published_at`, `updated_at`, `text`

---

## Then: analyze it with Claude

Once you have the `.csv`, ask Claude something like:

> "Read this YouTube comments file. Pull out the most common pain points,
> the exact phrases people use, recurring questions, and objections — group
> them into themes I can use for ad copy and landing-page headlines."

---

## Troubleshooting

- **"No YouTube API key found"** — `.env.local` is missing the
  `YOUTUBE_API_KEY=` line, or the file is in the wrong place (it must be in the
  project root, next to `package.json`).
- **"quota for today is used up"** — you've spent your 10,000 free units;
  it resets at **midnight Pacific Time**. Use `--max` / `--max-videos` to spend
  less per run.
- **"comments are turned off"** — that particular video has comments disabled;
  the script skips it and keeps going.
- **The key was rejected** — make sure **YouTube Data API v3** is *Enabled* for
  the same Google Cloud project the key belongs to.

## A note on fair use

These are **public** comments read through Google's official API. Respect
YouTube's Terms of Service and people's privacy — use the data for research and
copy insight, not for spamming or contacting individuals.
