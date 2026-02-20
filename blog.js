/**
 * BlogEngine — lightweight client-side blog system.
 * Posts are stored in Supabase.
 *
 * Post schema:
 *   { id, title, body, date, published }
 */

const BlogEngine = (() => {
  const SUPABASE_URL = 'https://hhfvdppuplqhubvhoqhz.supabase.co';
  const SUPABASE_KEY = 'YOUR_PUBLISHABLE_KEY_HERE'; // paste your publishable key here

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
    md = md.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, match => {
      mathChunks.push(match);
      return `%%MATH${mathChunks.length - 1}%%`;
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
        !/^%%SVG\d+%%$/.test(lines[i].trim())
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
    return escHtml(text)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
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
