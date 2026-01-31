# Blog component (static, GitHub Pages friendly)

This folder adds a simple blog you can click into from the homepage.

## Files
- `index.html` (homepage) — includes a link to `/blog/`
- `blog/index.html` — the blog UI (tabs + post viewer)
- `blog/posts.js` — your posts live here
- `styles.css` — includes a small extra section for blog styling

## Add a new post
Open `blog/posts.js` and add an object to `window.BLOG_POSTS`:

- `title`: shown on the tab
- `date`: "YYYY-MM-DD"
- `slug`: unique, used for URL hash (`/blog/#your-slug`)
- `html`: your content (HTML string)

Example:

{
  title: "My new post",
  date: "2026-02-01",
  slug: "my-new-post",
  html: `<p>Hello world.</p>`
}

## Deploy
Commit these files to your GitHub repo. GitHub Pages will serve `/blog/` automatically.

If your site is a project site (username.github.io/repo), keep links relative (this zip does).
