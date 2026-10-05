/**
 * BlogEngine — lightweight client-side blog system.
 * Posts are stored in Supabase.
 *
 * Post schema:
 *   { id, title, body, date, published }
 */

const BlogEngine = (() => {
  const SUPABASE_URL = 'https://hhfvdppuplqhubvhoqhz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_5OPZfytGWXxC_ugFtxxD3w_uj5lgUMR';

  // ── Supabase helpers ─────────────────────────────────────────────────────

  async function supabase(method, body, id) {
    const url = `${SUPABASE_URL}/rest/v1/posts${id ? `?id=eq.${id}` : ''}`;
    const res = await fetch(url, {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async function getPosts(includeDrafts = false) {
    let url = `${SUPABASE_URL}/rest/v1/posts?order=date.desc`;
    if (!includeDrafts) url += '&published=eq.true';
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    return res.json();
  }

  async function getPost(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${id}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await res.json();
    return data[0] || null;
  }

  async function createPost({ title, body, published = false }) {
    const data = await supabase('POST', {
      title,
      body,
      date: new Date().toISOString(),
      published,
    });
    return data[0];
  }

  async function updatePost(id, fields) {
    const data = await supabase('PATCH', fields, id);
    return data[0];
  }

  async function deletePost(id) {
    await supabase('DELETE', null, id);
  }

  // ── Formatting helpers ───────────────────────────────────────────────────

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function getExcerpt(md, maxLen = 160) {
    const plain = md
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/#{1,6}\s+/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    if (plain.length <= maxLen) return plain;
    return plain.slice(0, plain.lastIndexOf(' ', maxLen)) + '…';
  }

  function renderMarkdown(md) {
    if (!md) return '';

    const svgChunks = [];
    md = md.replace(/<svg[\s\S]*?<\/svg>/gi, match => {
      svgChunks.push(match);
      return `%%SVG${svgChunks.length - 1}%%`;
    });

    const mathChunks = [];
    const displayMathIndices = new Set();
    md = md.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, match => {
      const idx = mathChunks.length;
      if (match.startsWith('$$')) displayMathIndices.add(idx);
      mathChunks.push(match);
      return `%%MATH${idx}%%`;
    });

    const lines = md.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(escHtml(lines[i]));
          i++;
        }
        out.push(`<pre><code${lang ? ` class="language-${escHtml(lang)}"` : ''}>${codeLines.join('\n')}</code></pre>`);
        i++;
        continue;
      }

      if (/^(\*\*\*|---|___)\s*$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      const hMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (hMatch) {
        const level = hMatch[1].length;
        out.push(`<h${level}>${inlineRender(hMatch[2])}</h${level}>`);
        i++;
        continue;
      }

      if (line.startsWith('> ')) {
        const bqLines = [];
        while (i < lines.length && lines[i].startsWith('> ')) {
          bqLines.push(lines[i].slice(2));
          i++;
        }
        out.push(`<blockquote>${inlineRender(bqLines.join('\n'))}</blockquote>`);
        continue;
      }

      if (/^[-*+]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
          items.push(`<li>${inlineRender(lines[i].slice(2))}</li>`);
          i++;
        }
        out.push(`<ul>${items.join('')}</ul>`);
        continue;
      }

      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(`<li>${inlineRender(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join('')}</ol>`);
        continue;
      }

      if (/^%%SVG\d+%%$/.test(line.trim())) {
        out.push(line.trim());
        i++;
        continue;
      }

      const dmMatch = line.trim().match(/^%%MATH(\d+)%%$/);
      if (dmMatch && displayMathIndices.has(+dmMatch[1])) {
        out.push(line.trim());
        i++;
        continue;
      }

      if (line.trim() === '') {
        i++;
        continue;
      }

      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].startsWith('#') &&
        !lines[i].startsWith('> ') &&
        !/^[-*+]\s/.test(lines[i]) &&
        !/^\d+\.\s/.test(lines[i]) &&
        !lines[i].startsWith('```') &&
        !/^(\*\*\*|---|___)\s*$/.test(lines[i]) &&
        !/^%%SVG\d+%%$/.test(lines[i].trim()) &&
        !(lines[i].trim().match(/^%%MATH(\d+)%%$/) && displayMathIndices.has(+lines[i].trim().match(/^%%MATH(\d+)%%$/)[1]))
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        out.push(`<p>${inlineRender(paraLines.join(' '))}</p>`);
      }
    }

    return out.join('\n')
      .replace(/%%SVG(\d+)%%/g, (_, idx) => svgChunks[+idx])
      .replace(/%%MATH(\d+)%%/g, (_, idx) => mathChunks[+idx]);
  }

  function inlineRender(text) {
    // Math has already been replaced with %%MATH<n>%% placeholders by the
    // top-level renderMarkdown pass; those placeholders contain no markdown-
    // special characters, so they pass through escHtml + the formatters
    // unchanged and get restored to original $...$ at the very end.
    let result = escHtml(text)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      // Embeds ![alt|caption](src) — chooses image / YouTube / video / audio
      // based on the URL. MUST come before bold/italic and links.
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, altAndCaption, src) => {
        const pipeIndex = altAndCaption.indexOf('|');
        const alt = pipeIndex >= 0 ? altAndCaption.slice(0, pipeIndex).trim() : altAndCaption.trim();
        const caption = pipeIndex >= 0 ? altAndCaption.slice(pipeIndex + 1).trim() : '';

        const wrapFigure = (inner, centered) => {
          const figStyle = centered
            ? 'text-align:center; margin: 2em 0;'
            : 'margin: 1.5em 0;';
          if (caption) {
            return `<figure style="${figStyle}">${inner}<figcaption style="font-size: 0.9em; color: #555; margin-top: 0.75em; font-style: italic;">${escHtml(caption)}</figcaption></figure>`;
          }
          return `<figure style="${figStyle}">${inner}</figure>`;
        };

        // YouTube: matches youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID
        const yt = src.match(
          /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/
        );
        if (yt) {
          const id = yt[1];
          const iframe = `<iframe src="https://www.youtube.com/embed/${escAttr(id)}" title="${escAttr(alt || 'YouTube video')}" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; aspect-ratio:16/9; border:0; display:block;"></iframe>`;
          return wrapFigure(`<div style="max-width:80%; margin:0 auto;">${iframe}</div>`, true);
        }

        // Video files
        if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src)) {
          const video = `<video controls preload="metadata" style="max-width:80%; height:auto; display:block; margin:0 auto;"><source src="${escAttr(src)}"></video>`;
          return wrapFigure(video, true);
        }

        // Audio files
        if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(src)) {
          const audio = `<audio controls preload="metadata" style="width:80%; display:block; margin:0 auto;"><source src="${escAttr(src)}"></audio>`;
          return wrapFigure(audio, true);
        }

        // Image (default)
        const imgTag = `<img src="${escAttr(src)}" alt="${escAttr(alt)}" style="max-width:50%; height:auto; display:block; margin: 0 auto;">`;
        return wrapFigure(imgTag, !!caption);
      })
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, href) => {
        const safeHref = href.startsWith('http') || href.startsWith('/') || href.startsWith('mailto:')
          ? href : '#';
        return `<a href="${escAttr(safeHref)}" target="_blank" rel="noopener">${txt}</a>`;
      });

    return result;
  }

  // ── Figures ──
  // Restyles inline SVG diagrams at render time so they read like line art
  // from a 1980s textbook: black ink on white paper, labels in Computer
  // Modern, and any tinted fill replaced by a halftone dot screen. Works on
  // diagrams drawn for either a light or a dark background.
  const INK = '#111';
  const PAPER = '#fff';
  let figureCount = 0;

  function parseColor(c) {
    if (!c) return null;
    c = c.trim().toLowerCase();
    if (c === 'none' || c === 'transparent' || c.startsWith('url(')) return null;
    if (c === 'white') return [255, 255, 255, 1];
    if (c === 'black') return [0, 0, 0, 1];
    let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.replace(/./g, (x) => x + x);
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
    }
    m = c.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const v = m[1].split(',').map(parseFloat);
      return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
    }
    return null;
  }

  const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const sat = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

  function engraveFigures(root) {
    root.querySelectorAll('svg').forEach((svg) => {
      if (svg.dataset.engraved) return;
      svg.dataset.engraved = '1';

      const els = [svg, ...svg.querySelectorAll('*')];
      const colorOf = (el, prop) => parseColor(el.style[prop] || el.getAttribute(prop));

      // A diagram drawn for a dark page uses light colours as its "ink".
      const all = els.flatMap((el) => [colorOf(el, 'fill'), colorOf(el, 'stroke')]).filter(Boolean);
      const darkCanvas = all.length > 0 && !all.some((c) => lum(c) < 0.4);

      const fid = 'halftone-' + (++figureCount);
      const ns = 'http://www.w3.org/2000/svg';
      const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(ns, 'defs'), svg.firstChild);
      defs.insertAdjacentHTML('beforeend',
        `<pattern id="${fid}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
        `<rect width="4" height="4" fill="${PAPER}"/><circle cx="2" cy="2" r=".95" fill="${INK}"/></pattern>`);

      const classify = (c) => {
        const l = lum(c);
        if (darkCanvas) return l > 0.6 ? 'ink' : 'paper';
        if (l < 0.5) return 'ink';
        if (l > 0.88 && sat(c) < 0.08) return 'paper';
        return 'tint';
      };

      els.forEach((el) => {
        if (el.closest('pattern')) return;
        el.removeAttribute('filter');
        el.style.filter = 'none';

        const fill = colorOf(el, 'fill');
        if (fill) {
          const k = classify(fill);
          const isText = el.tagName === 'text' || el.closest('text');
          el.style.fill = k === 'ink' || isText ? INK : k === 'paper' ? PAPER : `url(#${fid})`;
          el.style.fillOpacity = '1';
        }

        const stroke = colorOf(el, 'stroke');
        if (stroke) {
          el.style.stroke = classify(stroke) === 'paper' && !darkCanvas ? PAPER : INK;
          el.style.strokeOpacity = '1';
        }

        if (el.tagName === 'text' || el.tagName === 'svg') {
          el.style.fontFamily = 'var(--font)';
        }
      });
    });
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  return {
    getPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    formatDate,
    getExcerpt,
    renderMarkdown,
    engraveFigures,
  };
})();
