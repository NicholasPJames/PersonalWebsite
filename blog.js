/**
 * BlogEngine — lightweight client-side blog system.
 * Posts are stored in localStorage as JSON.
 * Key: "nj_blog_posts"
 *
 * Post schema:
 *   { id, title, body, date, published }
 */

const BlogEngine = (() => {
  const STORAGE_KEY = 'nj_blog_posts';

  // ── Storage helpers ─────────────────────────────────────────────────────

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function save(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Return posts sorted newest-first.
   * @param {boolean} includeDrafts - default false (public pages only see published)
   */
  function getPosts(includeDrafts = false) {
    const posts = load();
    return posts
      .filter(p => includeDrafts || p.published)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /** Return a single post by id (regardless of published state). */
  function getPost(id) {
    return load().find(p => p.id === id) || null;
  }

  /** Create a new post. Returns the created post. */
  function createPost({ title, body, published = false }) {
    const posts = load();
    const post = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2),
      title,
      body,
      date: new Date().toISOString(),
      published,
    };
    posts.push(post);
    save(posts);
    return post;
  }

  /** Update an existing post by id. */
  function updatePost(id, fields) {
    const posts = load();
    const idx = posts.findIndex(p => p.id === id);
    if (idx === -1) return null;
    posts[idx] = { ...posts[idx], ...fields };
    save(posts);
    return posts[idx];
  }

  /** Delete a post by id. */
  function deletePost(id) {
    const posts = load().filter(p => p.id !== id);
    save(posts);
  }

  // ── Formatting helpers ───────────────────────────────────────────────────

  /** Format an ISO date string to a human-readable form. */
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /** Return a plain-text excerpt from a Markdown body. */
  function getExcerpt(md, maxLen = 160) {
    const plain = md
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')        // strip SVGs
      .replace(/#{1,6}\s+/g, '')                   // headings
      .replace(/!\[.*?\]\(.*?\)/g, '')             // images
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')   // links → text
      .replace(/[*_`~]/g, '')                      // emphasis chars
      .replace(/\n+/g, ' ')                        // newlines → space
      .trim();
    if (plain.length <= maxLen) return plain;
    return plain.slice(0, plain.lastIndexOf(' ', maxLen)) + '…';
  }

  /**
   * Markdown → HTML renderer.
   * Handles headings, bold, italic, inline code, code blocks,
   * blockquotes, unordered/ordered lists, horizontal rules, links,
   * paragraphs, inline SVG, and LaTeX math (via MathJax).
   */
  function renderMarkdown(md) {
    if (!md) return '';

    // ── 1. Pull out SVGs before any processing ──
    const svgChunks = [];
    md = md.replace(/<svg[\s\S]*?<\/svg>/gi, match => {
      svgChunks.push(match);
      return `%%SVG${svgChunks.length - 1}%%`;
    });

    // ── 2. Pull out math before HTML escaping ──
    const mathChunks = [];
    md = md.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, match => {
      mathChunks.push(match);
      return `%%MATH${mathChunks.length - 1}%%`;
    });

    const lines = md.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code blocks
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

      // Horizontal rule
      if (/^(\*\*\*|---|___)\s*$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // Headings
      const hMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (hMatch) {
        const level = hMatch[1].length;
        out.push(`<h${level}>${inlineRender(hMatch[2])}</h${level}>`);
        i++;
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        const bqLines = [];
        while (i < lines.length && lines[i].startsWith('> ')) {
          bqLines.push(lines[i].slice(2));
          i++;
        }
        out.push(`<blockquote>${inlineRender(bqLines.join('\n'))}</blockquote>`);
        continue;
      }

      // Unordered list
      if (/^[-*+]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
          items.push(`<li>${inlineRender(lines[i].slice(2))}</li>`);
          i++;
        }
        out.push(`<ul>${items.join('')}</ul>`);
        continue;
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(`<li>${inlineRender(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join('')}</ol>`);
        continue;
      }

      // SVG placeholder line — emit as-is
      if (/^%%SVG\d+%%$/.test(line.trim())) {
        out.push(line.trim());
        i++;
        continue;
      }

      // Blank line → paragraph break
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Paragraph: gather consecutive non-empty, non-special lines
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
        !/^%%SVG\d+%%$/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        out.push(`<p>${inlineRender(paraLines.join(' '))}</p>`);
      }
    }

    // ── 3. Restore SVGs and math ──
    return out.join('\n')
      .replace(/%%SVG(\d+)%%/g, (_, idx) => svgChunks[+idx])
      .replace(/%%MATH(\d+)%%/g, (_, idx) => mathChunks[+idx]);
  }

  /** Render inline Markdown: bold, italic, code, links. */
  function inlineRender(text) {
    // Restore any math placeholders first so escHtml doesn't touch them
    return escHtml(text)
      // Inline code
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Links [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, href) => {
        const safeHref = href.startsWith('http') || href.startsWith('/') || href.startsWith('mailto:')
          ? href : '#';
        return `<a href="${escAttr(safeHref)}" target="_blank" rel="noopener">${txt}</a>`;
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

  // ── Public surface ────────────────────────────────────────────────────────

  return {
    getPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    formatDate,
    getExcerpt,
    renderMarkdown,
  };
})();
