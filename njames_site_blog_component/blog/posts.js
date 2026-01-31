/*
  Add/edit posts here.

  Rules:
  - date: "YYYY-MM-DD"
  - slug: used in the URL hash (/blog/#my-slug). Must be unique.
  - html: post body as HTML (simple + reliable for GitHub Pages).

  Quick HTML cheatsheet:
    <p>Paragraph</p>
    <h3>Section</h3>
    <ul><li>Item</li></ul>
    <pre><code>code here</code></pre>
*/

window.BLOG_POSTS = [
  {
    title: "Hello, blog",
    date: "2026-01-31",
    slug: "hello-blog",
    html: `
      <p>This is a tiny, static blog that lives inside your GitHub Pages site.</p>
      <p>Edit <code>blog/posts.js</code> to add entries. Each post becomes a clickable tab with a date.</p>
      <h3>Why this approach?</h3>
      <ul>
        <li>No build step.</li>
        <li>No external dependencies.</li>
        <li>Fast, simple, and hard to break.</li>
      </ul>
    `
  },
  {
    title: "A note on learning (and shipping)",
    date: "2026-01-20",
    slug: "learning-and-shipping",
    html: `
      <p>Two modes I keep bouncing between:</p>
      <ul>
        <li><strong>Study:</strong> dig deep until the concepts click.</li>
        <li><strong>Ship:</strong> make the smallest artifact that is real.</li>
      </ul>
      <p>The trick is switching modes intentionally, not accidentally.</p>
    `
  }
];
