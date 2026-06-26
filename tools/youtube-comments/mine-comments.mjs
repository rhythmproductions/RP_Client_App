#!/usr/bin/env node
// ---------------------------------------------------------------------------
// YouTube comment miner
//
// Pulls public comments (author, text, likes, date) from any YouTube VIDEO,
// CHANNEL or PLAYLIST link into a .csv file you can open in Google Sheets /
// Google Docs / Excel.
//
// Built for the YouTube Data API v3. Zero npm dependencies — it only uses
// Node's built-in `fetch` (Node 18+), so there is nothing to install.
//
// Usage (from the repo root):
//   node tools/youtube-comments/mine-comments.mjs "<youtube link>"
//
// ...or just run it with no link and paste one when asked:
//   node tools/youtube-comments/mine-comments.mjs
//
// Options:
//   --replies            also include reply comments (default: top-level only)
//   --max <N>            stop after collecting N comments
//   --max-videos <N>     for channels/playlists, only mine the first N videos
//   --out <path>         where to save the .csv (default: ./output/<id>-<time>.csv)
//
// Your API key is read from the YOUTUBE_API_KEY environment variable, or from
// a .env.local / .env file in the repo root. It is NEVER printed or saved into
// the output file.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import readline from 'node:readline';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const SCRIPT_DIR = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

// How many quota "units" each kind of API call costs, per Google's docs.
// You get 10,000 units/day for free. We track these so you can see how much
// of your daily budget a run used.
const UNIT_COST = {
  commentThreads: 1,
  playlistItems: 1,
  channels: 1,
  videos: 1,
  search: 100, // resolving a custom /c/ URL is expensive — avoided when possible
};
let unitsUsed = 0;

// ── tiny .env loader ───────────────────────────────────────────────────────
// Reads KEY=VALUE lines from .env.local then .env (without overwriting real
// environment variables). Keeps your key out of the chat and out of git.
function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(REPO_ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

function getApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || key === 'your-youtube-api-key-here') {
    fail(
      'No YouTube API key found.\n\n' +
        'Add this line to a file called  .env.local  in the project root:\n' +
        '    YOUTUBE_API_KEY=the-key-you-copied-from-google-cloud\n\n' +
        '(.env.local is already ignored by git, so your key stays private.)'
    );
  }
  return key;
}

// ── argument parsing ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { input: null, replies: false, max: Infinity, maxVideos: Infinity, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--replies') opts.replies = true;
    else if (a === '--max') opts.max = parseInt(argv[++i], 10);
    else if (a === '--max-videos') opts.maxVideos = parseInt(argv[++i], 10);
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!a.startsWith('--') && !opts.input) opts.input = a;
  }
  return opts;
}

// ── core API call ───────────────────────────────────────────────────────────
async function ytGet(resource, params) {
  const key = getApiKey();
  const qs = new URLSearchParams({ ...params, key });
  unitsUsed += UNIT_COST[resource] ?? 1;
  const res = await fetch(`${API_BASE}/${resource}?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    const message = data?.error?.message || `HTTP ${res.status}`;
    if (reason === 'quotaExceeded')
      fail('Your YouTube API quota for today is used up. It resets at midnight Pacific Time.');
    if (reason === 'commentsDisabled') return { __commentsDisabled: true };
    if (reason === 'keyInvalid' || reason === 'badRequest')
      fail(`The API key was rejected by Google (${reason}). Double-check YOUTUBE_API_KEY.\n${message}`);
    fail(`YouTube API error (${reason || res.status}): ${message}`);
  }
  return data;
}

// ── figure out what kind of link this is ────────────────────────────────────
function parseTarget(input) {
  const raw = input.trim();

  // Bare 11-char video id or UC... channel id pasted on its own
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return { type: 'video', id: raw };
  if (/^UC[A-Za-z0-9_-]{22}$/.test(raw)) return { type: 'channel', channelId: raw };

  let u;
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    fail(`That doesn't look like a YouTube link or id: ${raw}`);
  }

  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') return { type: 'video', id: parts[0] };

  if (u.searchParams.get('v')) return { type: 'video', id: u.searchParams.get('v') };
  if (u.searchParams.get('list') && parts[0] === 'playlist')
    return { type: 'playlist', playlistId: u.searchParams.get('list') };

  if (parts[0] === 'watch' && u.searchParams.get('v')) return { type: 'video', id: u.searchParams.get('v') };
  if (['shorts', 'live', 'embed', 'v'].includes(parts[0]) && parts[1])
    return { type: 'video', id: parts[1] };

  if (parts[0] === 'channel' && parts[1]) return { type: 'channel', channelId: parts[1] };
  if (parts[0] === 'user' && parts[1]) return { type: 'channel', username: parts[1] };
  if (parts[0]?.startsWith('@')) return { type: 'channel', handle: parts[0] };
  if (parts[0] === 'c' && parts[1]) return { type: 'channel', custom: parts[1] };

  fail(`Couldn't tell whether this is a video or a channel: ${raw}`);
}

// ── resolve a channel reference to its "uploads" playlist ───────────────────
async function resolveUploadsPlaylist(target) {
  let params;
  if (target.channelId) params = { part: 'contentDetails,snippet', id: target.channelId };
  else if (target.handle) params = { part: 'contentDetails,snippet', forHandle: target.handle };
  else if (target.username) params = { part: 'contentDetails,snippet', forUsername: target.username };
  else if (target.custom) {
    // Custom /c/<name> URLs aren't directly resolvable — fall back to search.
    const found = await ytGet('search', { part: 'snippet', q: target.custom, type: 'channel', maxResults: '1' });
    const id = found.items?.[0]?.snippet?.channelId;
    if (!id) fail(`Couldn't find a channel for "${target.custom}".`);
    params = { part: 'contentDetails,snippet', id };
  }

  const data = await ytGet('channels', params);
  const item = data.items?.[0];
  if (!item) fail('Channel not found. Check the link.');
  return {
    title: item.snippet?.title || 'channel',
    uploadsPlaylist: item.contentDetails?.relatedPlaylists?.uploads,
  };
}

// ── list every video id in a playlist (the channel's uploads, or a real one) ─
async function listPlaylistVideoIds(playlistId, maxVideos) {
  const ids = [];
  let pageToken;
  do {
    const data = await ytGet('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const it of data.items || []) {
      if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
      if (ids.length >= maxVideos) return ids.slice(0, maxVideos);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

// ── look up video titles in batches of 50 (1 unit per batch) ────────────────
async function getVideoTitles(videoIds) {
  const titles = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await ytGet('videos', { part: 'snippet', id: batch.join(','), maxResults: '50' });
    for (const it of data.items || []) titles[it.id] = it.snippet?.title || '';
  }
  return titles;
}

// ── pull all comment threads for one video ──────────────────────────────────
async function fetchComments(videoId, videoTitle, { includeReplies, remaining }) {
  const rows = [];
  let pageToken;
  do {
    const data = await ytGet('commentThreads', {
      part: 'snippet,replies',
      videoId,
      maxResults: '100',
      order: 'relevance',
      textFormat: 'plainText',
      ...(pageToken ? { pageToken } : {}),
    });
    if (data.__commentsDisabled) {
      console.log(`   ↳ comments are turned off for this video — skipping.`);
      break;
    }
    for (const thread of data.items || []) {
      const top = thread.snippet?.topLevelComment?.snippet;
      if (top) rows.push(rowFrom(top, videoId, videoTitle, thread.snippet.topLevelComment.id, '', false));
      if (rows.length >= remaining) return rows.slice(0, remaining);
      if (includeReplies && thread.replies?.comments) {
        for (const rep of thread.replies.comments) {
          rows.push(rowFrom(rep.snippet, videoId, videoTitle, rep.id, rep.snippet?.parentId || '', true));
          if (rows.length >= remaining) return rows.slice(0, remaining);
        }
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return rows;
}

function rowFrom(s, videoId, videoTitle, commentId, parentId, isReply) {
  return {
    video_id: videoId,
    video_title: videoTitle,
    comment_id: commentId,
    parent_id: parentId,
    is_reply: isReply ? 'yes' : 'no',
    author: s?.authorDisplayName || '',
    author_channel_id: s?.authorChannelId?.value || '',
    likes: s?.likeCount ?? 0,
    published_at: s?.publishedAt || '',
    updated_at: s?.updatedAt || '',
    text: s?.textDisplay || s?.textOriginal || '',
  };
}

// ── CSV writing (Excel/Sheets-safe quoting + UTF-8 BOM for emoji) ───────────
const COLUMNS = [
  'video_id', 'video_title', 'comment_id', 'parent_id', 'is_reply',
  'author', 'author_channel_id', 'likes', 'published_at', 'updated_at', 'text',
];

function csvCell(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function writeCsv(rows, outPath) {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => csvCell(r[c])).join(','));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, '﻿' + lines.join('\r\n'), 'utf8');
}

// ── prompt for a link if none was given on the command line ─────────────────
function askForLink() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nPaste a YouTube video or channel link, then press Enter:\n> ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function slugify(s) {
  return String(s).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'youtube';
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  loadEnvFiles();
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(fs.readFileSync(path.join(SCRIPT_DIR, 'README.md'), 'utf8'));
    return;
  }

  let input = opts.input;
  if (!input) input = await askForLink();
  if (!input) fail('No link given. Nothing to do.');

  const target = parseTarget(input);
  const allRows = [];
  let label;

  if (target.type === 'video') {
    label = target.id;
    const titles = await getVideoTitles([target.id]);
    console.log(`\n🎬 Video: ${titles[target.id] || target.id}`);
    const rows = await fetchComments(target.id, titles[target.id] || '', {
      includeReplies: opts.replies,
      remaining: opts.max,
    });
    allRows.push(...rows);
    console.log(`   collected ${rows.length} comments`);
  } else {
    let playlistId;
    if (target.type === 'playlist') {
      playlistId = target.playlistId;
      label = playlistId;
      console.log(`\n📃 Playlist: ${playlistId}`);
    } else {
      const ch = await resolveUploadsPlaylist(target);
      playlistId = ch.uploadsPlaylist;
      label = slugify(ch.title);
      console.log(`\n📺 Channel: ${ch.title}`);
      if (!playlistId) fail('This channel has no public uploads to read.');
    }

    const videoIds = await listPlaylistVideoIds(playlistId, opts.maxVideos);
    console.log(`   found ${videoIds.length} videos. Mining comments...`);
    const titles = await getVideoTitles(videoIds);

    for (let i = 0; i < videoIds.length; i++) {
      if (allRows.length >= opts.max) break;
      const vid = videoIds[i];
      process.stdout.write(`   [${i + 1}/${videoIds.length}] ${titles[vid] || vid} ... `);
      const rows = await fetchComments(vid, titles[vid] || '', {
        includeReplies: opts.replies,
        remaining: opts.max - allRows.length,
      });
      allRows.push(...rows);
      console.log(`${rows.length} comments (running total ${allRows.length})`);
    }
  }

  if (allRows.length === 0) {
    console.log('\nNo comments were collected. (The video/channel may have comments disabled.)');
    return;
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const outPath = path.resolve(opts.out || path.join(SCRIPT_DIR, 'output', `${slugify(label)}-${stamp}.csv`));
  writeCsv(allRows, outPath);

  console.log('\n────────────────────────────────────────────────────');
  console.log(`✅ Saved ${allRows.length} comments to:`);
  console.log(`   ${outPath}`);
  console.log(`   API quota used this run: ${unitsUsed} of your 10,000 daily units.`);
  console.log('\nTo open in Google Sheets: drive.google.com → New → File upload → pick the .csv');
  console.log('(or in Sheets: File → Import → Upload).');
  console.log('────────────────────────────────────────────────────\n');
}

main().catch((err) => fail(err?.stack || String(err)));
