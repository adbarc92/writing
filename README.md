# adbarc92.github.io

Personal portfolio site — [alexanderdbarclay.com/writing](https://alexanderdbarclay.com/writing)

## Stack

- React 19 + TypeScript
- Vite
- React Router (client-side SPA)
- Markdown content with YAML frontmatter

## Development

```bash
npm install
npm run dev       # Dev server at localhost:5173
npm run build     # Type-check + production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Content

Blog posts and projects are Markdown files with YAML frontmatter:

- `content/blog/*.md` — Blog posts
- `content/projects/*.md` — Project entries
- `content/about.md` — About page

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via GitHub Actions. The domain root (`adbarc92.github.io`) is served by a separate project, `portfolio-treatise`; this repository is a GitHub Pages *project* site, published under `/writing/`.
