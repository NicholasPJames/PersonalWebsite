#!/usr/bin/env node
/**
 * Generates a static HTML file per published post at /p/<id>.html.
 *
 * Each generated file is a full copy of blog-post.html with:
 *   - <title> and OpenGraph meta tags baked in (so iMessage/Twitter/Slack
 *     show the real post title/description in link previews)
 *   - asset paths rewritten to ../ (since the file lives in /p/)
 *   - the post ID hardcoded into the loader script
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
const TEMPLATE_PATH = path.join(ROOT, 'blog-post.html');

function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(d) {
  return new Date(d).toUTCString();
}

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

function renderPostPage(template, post) {
  const title = post.title || 'Untitled';
  const desc = getExcerpt(post.body);
  const id = post.id;
  const canonical = `${SITE_ORIGIN}/p/${encodeURIComponent(id)}.html`;
  const idJson = JSON.stringify(id);

  // 1) Bake static meta tags + title into <head>.
  const metaBlock =
    `<title>${escHtml(title)} — Nick James</title>\n` +
    `    <meta name="description" content="${escHtml(desc)}" />\n` +
    `    <meta property="og:title" content="${escHtml(title)}" />\n` +
    `    <meta property="og:description" content="${escHtml(desc)}" />\n` +
    `    <meta property="og:url" content="${escHtml(canonical)}" />\n` +
    `    <meta property="og:type" content="article" />\n` +
    `    <meta property="og:image" content="${SITE_ORIGIN}/assets/og-image.png" />\n` +
    `    <meta name="twitter:card" content="summary_large_image" />\n` +
    `    <meta name="twitter:title" content="${escHtml(title)}" />\n` +
    `    <meta name="twitter:description" content="${escHtml(desc)}" />\n` +
    `    <meta name="twitter:image" content="${SITE_ORIGIN}/assets/og-image.png" />\n` +
    `    <link rel="canonical" href="${escHtml(canonical)}" />`;

  let html = template.replace(/<title>[^<]*<\/title>/, metaBlock);

  // 2) Adjust asset / link paths since file lives in /p/.
  html = html
    .replace(/href="styles\.css"/g, 'href="../styles.css"')
    .replace(/src="blog\.js"/g, 'src="../blog.js"')
    .replace(/href="index\.html"/g, 'href="../index.html"')
    .replace(/href="blog\.html"/g, 'href="../blog.html"')
    .replace(/href="bookshelf\.html"/g, 'href="../bookshelf.html"');

  // 3) Replace the URL-param post lookup with the hardcoded ID.
  html = html.replace(
    /const params = new URLSearchParams\(window\.location\.search\);\s*\n\s*const id = params\.get\('id'\);/,
    `const id = ${idJson};`
  );

  return html;
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
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Wipe stale files (posts that were unpublished or deleted).
  const validIds = new Set(posts.map((p) => `${p.id}.html`));
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html') && !validIds.has(f)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      console.log(`Removed ${f}`);
    }
  }

  for (const post of posts) {
    const html = renderPostPage(template, post);
    fs.writeFileSync(path.join(OUT_DIR, `${post.id}.html`), html);
  }
  console.log(`Generated ${posts.length} post page(s) in /p`);

  // ── RSS feed ────────────────────────────────────────────────────────
  const sorted = [...posts].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  const items = sorted
    .map((post) => {
      const url = `${SITE_ORIGIN}/p/${encodeURIComponent(post.id)}.html`;
      const desc = getExcerpt(post.body, 400);
      return `    <item>
      <title>${escXml(post.title || 'Untitled')}</title>
      <link>${escXml(url)}</link>
      <guid isPermaLink="true">${escXml(url)}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <description>${escXml(desc)}</description>
    </item>`;
    })
    .join('\n');

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Nick James</title>
    <link>${SITE_ORIGIN}</link>
    <description>Mathematics and comparative literature.</description>
    <language>en-us</language>
    <atom:link href="${SITE_ORIGIN}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${rfc822(new Date())}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(ROOT, 'feed.xml'), feed);
  console.log('Generated feed.xml');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
