/**
 * BookshelfEngine — lightweight client-side bookshelf system.
 * Books are stored in Supabase.
 *
 * Book schema:
 *   { id, title, author, cover_url, summary, date_added, sort_order }
 */

const BookshelfEngine = (() => {
  const SUPABASE_URL = 'https://hhfvdppuplqhubvhoqhz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_5OPZfytGWXxC_ugFtxxD3w_uj5lgUMR';

  // ── Supabase helpers ─────────────────────────────────────────────────────

  async function supabase(method, body, id) {
    const url = `${SUPABASE_URL}/rest/v1/books${id ? `?id=eq.${id}` : ''}`;
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

  async function getBooks() {
    const url = `${SUPABASE_URL}/rest/v1/books?order=sort_order.asc,date_added.desc`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    return res.json();
  }

  async function getBook(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${id}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await res.json();
    return data[0] || null;
  }

  async function createBook({ title, author, cover_url, summary, sort_order }) {
    const data = await supabase('POST', {
      title,
      author,
      cover_url: cover_url || '',
      summary: summary || '',
      sort_order: sort_order || 0,
      date_added: new Date().toISOString(),
    });
    return data[0];
  }

  async function updateBook(id, fields) {
    const data = await supabase('PATCH', fields, id);
    return data[0];
  }

  async function deleteBook(id) {
    await supabase('DELETE', null, id);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  return {
    getBooks,
    getBook,
    createBook,
    updateBook,
    deleteBook,
    formatDate,
  };
})();
