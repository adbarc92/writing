# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio and writing site with an animated WebGL gear background, essays, project showcase, and the Eidos specification. React 19 + TypeScript + Vite SPA with client-side routing, prerendered to static HTML at build time.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # tsc -b, then vite build, then prerender static HTML
npm run test      # Vitest (pure logic in src/lib)
npm run lint      # ESLint (flat config, TS-aware)
npm run preview   # Preview production build
```

## Architecture

Multi-page SPA with persistent animated background:

- **`src/main.tsx`** — React entry point, renders `<App />` in StrictMode
- **`src/App.tsx`** — Router setup with `createBrowserRouter`, `basename` from `BASE_PATH`
- **`src/components/Layout.tsx`** — Persistent layout: GearBackground + NavBar + Outlet
- **`src/components/GearBackground.tsx`** — Three.js/WebGL gear background; scene, materials, meshes, and animation live in `src/lib/gear-*.ts`
- **`src/components/NavBar.tsx`** — Fixed nav bar (hidden on landing page)
- **`src/lib/gears.ts`** — Involute gear profile generation and multi-chain layout
- **`src/pages/`** — Landing, Blog, BlogPost, Projects, ProjectDetail, About, Eidos, EidosDoc

### Content pipeline

These modules are split so `scripts/prerender.ts` can import them under plain Node. Keep them free of `import.meta` and of side effects:

- **`src/lib/markdown.ts`** — `marked` / `highlight.js` config, `parseMarkdown`, slug rules
- **`src/lib/frontmatter.ts`** — frontmatter types, the closed `Category` set, draft flag
- **`src/lib/site.ts`** — `SITE` constants, shared page descriptions, `BASE_PATH` and URL helpers
- **`src/lib/dates.ts`** / **`src/lib/escape.ts`** — UTC date formatting; HTML and XML escaping
- **`src/lib/content.ts`** — the `import.meta.glob` loaders (browser only)

Markdown files with YAML frontmatter:

- **`content/blog/*.md`** — Essays (date prefix in filename for slug; `category` required, `draft` optional)
- **`content/projects/*.md`** — Project entries
- **`content/eidos/*.md`** — Eidos specification documents (sequenced by `order`)
- **`content/about.md`** — About page content

### Deployment

This repository is `adbarc92/writing`. Pushes to `main` build and deploy to GitHub Pages via `.github/workflows/deploy.yml`.

It is a Pages *project* site published under `/writing/` — the domain root (`alexanderdbarclay.com`, served out of `adbarc92.github.io`) belongs to a separate treatise project. `BASE_PATH` in `src/lib/site.ts`, `base` in `vite.config.ts`, and the router's `basename` must all agree.

`scripts/prerender.ts` runs after `vite build` and emits static HTML per route with per-page `<head>` metadata, plus `404.html`, `rss.xml`, and `sitemap.xml`.

## Key Patterns

- Gear background is a fixed WebGL canvas behind all content (z-index 0)
- Direct mutation of Three.js objects in the animation loop (performance — avoids React re-renders)
- Content loaded via `import.meta.glob` with `?raw` query, parsed at runtime
- All pages use inline styles via React style objects
- Crawler-visible metadata comes from the prerender, not from React. React 19 only adopts a prerendered `<meta>` when name and content match exactly, so shared strings are single-sourced in `src/lib/site.ts`
- TypeScript strict mode enabled; no unused locals/parameters allowed

## Remotes and branches

- **`writing`** → `github.com/adbarc92/writing` — this project's real remote. `main` deploys; feature branches merge into it by PR.
- **`origin`** → `github.com/adbarc92/adbarc92.github.io` — **not this project.** That branch holds the treatise's built static output and publishes the domain root. Never push this repository's source to it.
