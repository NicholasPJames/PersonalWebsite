#!/usr/bin/env node
/**
 * Generates a small static HTML file per published post at /p/<id>.html.
 * Each file carries proper <title>, description, and OpenGraph tags so
 * that messaging apps (iMessage, Twitter, Slack…) and search engines see
 * the actual post title in the link preview, then redirects the user to
 * the dynamic blog-post.html page for reading.
 *
 * Run via: `node scripts/build-posts.js`
 * Requires Node 18+ (uses built-in fetch). No npm dependencies.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hhfvdppuplqhubvhoqhz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5OPZfytGWXxC_ugFtxxD3w_uj5lgUMR';
const SITE_ORIGIN = 'https://njames.xyz';

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'p');

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip markdown / math / svg / code fences down to a plain-text excerpt.
function getExcerpt(body, max = 180) {
  if (!body) return '';
  const text = String(body)
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$[\s\S]+?\$\$/g, '')
    .replace(/\$[^$\n]+?\$/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

function renderRedirectPage(post) {
  const title = post.title || 'Untitled';
  const desc = getExcerpt(post.body);
  const id = post.id;
  const dynamicUrl = `/blog-post.html?id=${encodeURIComponent(id)}`;
  const canonical = `${SITE_ORIGIN}/p/${encodeURIComponent(id)}.html`;
  // Inline JS redirect uses location.replace so it doesn't pollute history.
  // The escape on id is JSON-stringified for safe embedding.
  const idJson = JSON.stringify(id);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)} — Nick James</title>
<meta name="description" content="${escHtml(desc)}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${escHtml(canonical)}">
<meta property="og:type" content="article">
<meta property="og:image" content="${SITE_ORIGIN}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${SITE_ORIGIN}/assets/og-image.png">
<link rel="canonical" href="${escHtml(canonical)}">
<meta http-equiv="refresh" content="0; url=${escHtml(dynamicUrl)}">
</head>
<body>
<script>location.replace('/blog-post.html?id=' + encodeURIComponent(${idJson}));</script>
<noscript><a href="${escHtml(dynamicUrl)}">Read ${escHtml(title)}</a></noscript>
</body>
</html>
`;
}

async function main() {
  const url = `${SUPABASE_URL}/rest/v1/posts?published=eq.true&select=id,title,body,date`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  }
  const posts = await res.json();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Wipe stale files (posts that were unpublished or deleted) so the
  // generated directory always reflects current state.
  const validIds = new Set(posts.map((p) => `${p.id}.html`));
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html') && !validIds.has(f)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      console.log(`Removed ${f}`);
    }
  }

  for (const post of posts) {
    const html = renderRedirectPage(post);
    fs.writeFileSync(path.join(OUT_DIR, `${post.id}.html`), html);
  }
  console.log(`Generated ${posts.length} post page(s) in /p`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
