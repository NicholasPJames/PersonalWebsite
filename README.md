# Simple Black Static Site (GitHub Pages)

This repo is a minimal personal landing page: **black background, white text**, with a bio and links.

## Quick start (GitHub Pages)

1. Create a new GitHub repo (e.g. `my-site`).
2. Drag-and-drop these files into the repo (or upload them).
3. Go to **Settings → Pages**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or `master`) and **/ (root)**
4. Your site will appear at: `https://<your-username>.github.io/<repo-name>/`

## Adding PDFs / files

- Put PDFs in the `assets/` folder.
- Update the links in `index.html`, e.g.:
  ```html
  <a href="assets/my-paper.pdf">My Paper</a>
  ```

## Customize

- Edit the name/tagline in `index.html`.
- Edit the styles in `styles.css` (already set up for black/white).

That's it.
