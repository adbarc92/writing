# Essays, Taxonomy, and the Eidos Section — Design

**Date:** 2026-08-10
**Branch:** `feat/essays-and-taxonomy`, landed on `writing/main`
**Status:** Implemented and deployed 2026-08-11. See the
[implementation plan](2026-08-10-essays-and-taxonomy-plan.md) for the task-level record.

---

## Goal

Publish the Eidos essay and its four-document specification, and remove the friction
that would otherwise make each subsequent essay a chore. Three capabilities fall out
of that: a draft state so unfinished work can be committed without going live, a
category taxonomy so fiction, software, and political writing can share one feed
without colliding, and a home for the specification that the essay can point at.

## Non-goals

- A post-scaffolding script (`npm run new:post`). Deferred; frontmatter is short enough to copy.
- Frontmatter validation as a build gate. Deferred.
- Typography work beyond what longform readability requires (see Component 5).
- Multi-version hosting of the specification. One version is live; git holds history.
- Migration to Astro, adoption of a headless CMS, and any move to Substack. Surveyed and
  declined for now; see Component 7 for the reasoning that replaces them.
- Syndication and email (dev.to, Hashnode, Buttondown). Component 7 makes these possible
  by producing a feed and correct metadata; performing them is a separate, manual act.

---

## Component 1 — Content schema

**File:** `src/lib/content.ts`

Introduce a closed category set and open tags:

```ts
export type Category = 'software' | 'fiction' | 'politics' | 'meta';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'software', label: 'Software' },
  { id: 'fiction',  label: 'Fiction' },
  { id: 'politics', label: 'Politics' },
  { id: 'meta',     label: 'Meta' },
];
```

`BlogFrontmatter` gains `category: Category` (required) and `draft?: boolean`.
`tags: string[]` is retained, unchanged, for cross-cutting filters such as
`architecture` or `ai` that span categories.

The category set is closed because an open one drifts — `politics` and `political`
both come to exist, and the filter silently splits. Adding a category is a two-line
change confined to this file. Tags stay open because their value is exactly that
they are cheap to coin.

A new `EidosFrontmatter` describes specification documents:

```ts
export interface EidosFrontmatter {
  title: string;
  order: number;
  version: string;
  summary: string;
}
```

**Refactor.** `loadBlogPosts` / `loadBlogPost` / `loadProjects` / `loadProject` are
four near-identical functions differing only in their glob and sort. This change adds
a fifth and sixth. Collapse them onto a generic pair — a loader that maps a glob to
parsed entries and a lookup that resolves one slug — with the public function names
and signatures preserved so no page changes. This is the only refactor in scope, and
it is in code the change already has to touch.

**Split.** The parsing half of this module must also run under Node, because the
prerender script in Component 7 needs identical output to the browser's. Extract
`src/lib/markdown.ts` holding the `marked` and `highlight.js` configuration,
`parseMarkdown`, and the two slug rules — pure functions with no `import.meta.glob`,
importable from a plain Node process. `src/lib/content.ts` keeps the globs and the
loaders and imports from it. Without this split the script would re-declare the
renderer, and the two copies would drift.

**Slug derivation.** The existing rule strips a `YYYY-MM-DD-` prefix. Eidos documents
are ordered rather than dated, so their rule strips a leading `NN-`:
`01-architecture.md` → `architecture`. Two rules, selected per collection.

## Component 2 — Draft state

**Files:** `src/lib/content.ts`, `src/components/BlogCard.tsx`, `src/pages/BlogPost.tsx`

A post with `draft: true` is filtered out at two points:

1. `loadBlogPosts()` — omitted from the index.
2. `loadBlogPost(slug)` — returns `null`, so the post renders the existing
   "Post not found" state rather than being reachable by anyone who guesses the slug.

Both filters are suppressed when `import.meta.env.DEV` is true, so drafts are visible
and navigable in `npm run dev` and absent from the production build. Publishing is
then the deletion of one line.

Drafts carry a DRAFT badge on the card and the post page, rendered only in dev. Its
purpose is to prevent the failure mode where a draft read in the dev server is assumed
to be live.

**Known limitation, accepted.** `import.meta.glob` emits every markdown file in the
globbed directory as a fetchable chunk in `dist/`, so `draft: true` hides a post from
the site without keeping its text out of the build. A determined reader could recover
draft prose from devtools. The alternative — an unglobbed `content/drafts/` directory —
is genuinely absent from the bundle but reintroduces the friction this component exists
to remove, since previewing would require moving the file. The flag is the right trade
for a personal site; if a draft is ever sensitive, it stays out of the repository.

## Component 3 — Filtering on /blog

**Files:** `src/pages/Blog.tsx`, new `src/components/CategoryFilter.tsx`,
`src/components/BlogCard.tsx`, `src/pages/BlogPost.tsx`

One feed, newest first, with a chip row above it: `All` followed by one chip per
category that has at least one visible post. Categories with no posts render no chip,
so the taxonomy can be declared ahead of the writing without advertising empty rooms.

Filter state lives in the URL through `useSearchParams`:

- `/blog?category=fiction`
- `/blog?tag=architecture`

Putting it in the URL rather than component state makes a filtered view shareable and
survives a reload, which is the whole reason to prefer it. The two parameters compose:
a category and a tag together narrow to the intersection.

Tags rendered on `BlogPost` become links into `/blog?tag=<tag>`. On `BlogCard` they do
not: the card itself is already a react-router `<Link>` to the post, and nesting
interactive content inside an anchor is invalid HTML, so the tag `<span>`s on the card
stay non-interactive labels. This is a deliberate deviation from the original plan of
linking tags on both components. It costs nothing in practice — the category chip row
above the feed is the reachable path into a filtered view from the index — and the tag
link on `BlogPost` still lets a reader jump from an individual post into `/blog?tag=`.
When a filter matches nothing, the page says so and offers a link back to the
unfiltered feed.

## Component 4 — The /eidos section

**Files:** new `content/eidos/*.md`, new `src/pages/Eidos.tsx`, new
`src/pages/EidosDoc.tsx`, `src/App.tsx`, `src/components/NavBar.tsx`

The specification is reference material, not writing, and putting four documents into
the feed would bury the essay under its own appendices. It gets a section.

**Routes:**

- `/eidos` — index. Section title, version badge from the documents' shared `version`,
  a link to the essay, and one card per document showing its `summary`.
- `/eidos/:slug` — a document. Sidebar listing all four in `order` with the current one
  marked, article body, and previous/next links at the foot.

**Content files**, from the supplied sources:

| Source | File | Slug |
|---|---|---|
| `01-EIDOS.md` | `content/eidos/01-architecture.md` | `architecture` |
| `02-ADOPTION.md` | `content/eidos/02-adoption.md` | `adoption` |
| `03-FORM-TEMPLATE.md` | `content/eidos/03-form-template.md` | `form-template` |
| `04-INFRASTRUCTURE.md` | `content/eidos/04-infrastructure.md` | `infrastructure` |

`NavBar` gains `{ to: '/eidos', label: 'Eidos' }`, and its existing `/blog` entry is
relabelled `Writing` — the route is unchanged, but "Blog" describes the coming mix of
fiction and political writing poorly.

## Component 5 — Prose styles

**File:** `src/index.css`

The global reset sets `margin: 0` on every element, and nothing restores it for the
HTML that `marked` produces into `dangerouslySetInnerHTML`. Every paragraph, heading,
and list in a rendered document therefore has no spacing, and `ul { padding: 0 }`
pushes bullets outside their container. The single existing post is short enough to
have concealed this; a 2,300-word essay would not, and three of the four specification
documents are built on tables, which currently render without borders or cell padding.

Add a `.prose` class, applied to the `<article>` in `BlogPost`, `ProjectDetail`, and
`EidosDoc`, scoping rules to rendered markdown only:

- `p`, `ul`, `ol`, `blockquote` — vertical rhythm and list indentation
- `h2`, `h3`, `h4` — size, weight, and asymmetric margins (more above than below)
- `table`, `th`, `td` — borders from `--color-gear-stroke`, cell padding, header weight,
  and a horizontally scrollable wrapper so wide tables do not force page scroll
- `hr`, `strong`, `em`, `blockquote` — using existing custom properties throughout

No new tokens and no font changes. This is the minimum that makes longform legible.

## Component 6 — Content and editorial pass

**Blog post:** `content/blog/2026-08-10-eidos-an-architecture-for-cheap-code.md`,
from `essay-v4.md`, published live (no draft flag), `category: software`,
tags `architecture`, `ai`, `philosophy`.

**Backfill:** the existing `2026-02-27-hello-world.md` gains `category: meta`, since
`category` is required, and loses its duplicate `# Hello World` H1.

**Editorial rules applied to all five documents:**

1. **Restore the encoding.** Every source arrived with UTF-8 misread as Latin-1: `â`
   where a dash belongs, `Â§` for `§`. Em dash and en dash both collapsed to the same
   character, so restoration is contextual, not mechanical — em dash throughout, except
   `costâbenefit` → `cost–benefit` and the two occurrences of
   `registry â enforcement parity` → `registry ↔ enforcement parity`.
2. **Strip the leading H1.** Every page renders `frontmatter.title` as the `<h1>`;
   a body starting at `#` duplicates it. Bodies start at `##`.
3. **Strip process metadata.** The `*Draft v4 — publication critique applied…*` line
   records how the draft was revised and is not part of the essay.
4. **Lift subtitles into frontmatter.** `**The canonical specification — v0.2, July
   2026**` and its siblings become `version` and render in the page header.
5. **Change nothing else.** No rewriting, retitling, or restructuring of the prose.

The essay's closing line — *"[The specification, and the systems that demonstrate it,
continue from here.]"* — is replaced by a real link to `/eidos`, which is what the
bracket was standing in for.

## Component 7 — Crawlability

**Files:** new `src/lib/site.ts`, new `scripts/prerender.ts`, `package.json`,
`.github/workflows/deploy.yml`, and a `<title>`/`<meta>` pair in each page component

The site is a client-rendered SPA whose `index.html` carries no description and no
Open Graph tags, and whose deploy copies that same shell to `404.html` so every route
resolves to it. A crawler requesting the essay receives `<div id="root"></div>` and the
title "Alex Barclay". Google will execute the JavaScript eventually and imperfectly;
Bing, LinkedIn, Slack, X, Discord, and most AI crawlers will not. Every link to the
essay, wherever it is posted, unfurls as a blank card.

This is the highest-leverage traffic work available, it is a precondition for
syndicating anywhere, and it is the reason a platform migration is unnecessary rather
than merely premature. It ships with the essay.

**Approach: generate static HTML per content route at build time.** The alternatives
were an SSG framework migration (Astro — correct eventually, wrong this week) and a
headless-browser crawl of the built site (a Playwright pass over `dist/`, which drags a
browser into CI to recover HTML we can produce directly). Neither earns its cost when
the content is markdown we already parse and the requirement is metadata plus readable
text.

**`src/lib/site.ts`** — one module of constants shared by the app and the script:
canonical origin (`https://alexanderdbarclay.com`, base path `/`, since this is a GitHub
user page), site title, author, default description, default social image.

> **Superseded.** The base path is `/writing`, not `/`. This site is a GitHub Pages
> *project* site: the domain root is published from a separate treatise repository, so
> the root was taken before this shipped. Task 15 in the implementation plan makes the
> change; `BASE_PATH` in `src/lib/site.ts` is the single source of truth. The paragraph
> above is left as written, because the assumption it records is why the base path had
> to be retrofitted rather than designed in.

**`scripts/prerender.ts`**, run after `vite build`, using `fs` plus the shared
`markdown.ts`:

1. Read every file in `content/blog`, `content/projects`, and `content/eidos`, skipping
   posts with `draft: true`.
2. For each content route and each static route (`/`, `/blog`, `/projects`, `/about`,
   `/eidos`), write `dist/<route>/index.html` — the built shell with a per-page
   `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph tags
   (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`), and
   `twitter:card`.
3. Inject the rendered article HTML into `#root` in that file, so a client that never
   executes JavaScript still receives the text.
4. Emit `dist/rss.xml` from non-draft posts and `dist/sitemap.xml` from all public routes.
5. Write `dist/404.html` from the bare shell, and delete the `cp index.html 404.html`
   step from the workflow — the fallback belongs with the rest of the HTML generation,
   and moving it makes `npm run preview` behave like production.

Wired as `"build": "tsc -b && vite build && tsx scripts/prerender.ts"`, so there is no
way to produce a deployable build without metadata.

**Hydration is deliberately not attempted.** `main.tsx` calls `createRoot().render()`,
which discards whatever is inside `#root` and renders fresh. The injected HTML is for
crawlers; the browser throws it away microseconds later and draws the real app. Using
`hydrateRoot` instead would demand that the script's output match React's exactly and
would import the entire hydration-mismatch failure class for no reader-visible gain.
The corollary worth stating: because the script never executes React, the Three.js gear
background never runs under Node, which is what makes this approach cheap.

**Client-side navigation** still needs correct head tags once the SPA takes over.
React 19 hoists `<title>` and `<meta>` elements rendered anywhere in the tree, so each
page component renders its own — no helmet library, no new dependency.

**One new devDependency: `tsx`,** to run a TypeScript script that imports
`src/lib/markdown.ts`. Node 22 could strip types natively, but CI pins Node 20 and the
flag is experimental; `tsx` is the conventional answer and works on both.

---

## Verification

No test framework is configured, so verification is `npm run build` (which type-checks),
`npm run lint`, and a manual pass at `localhost:5173`:

- The essay renders with paragraph spacing, and its links resolve.
- All four specification documents render, tables included, with working sidebar
  navigation and prev/next.
- Category chips filter the feed; `?category=` and `?tag=` survive a reload; a tag click
  from a post lands on a correctly filtered feed.
- A scratch post with `draft: true` appears in dev with its badge and is absent from
  `npm run build && npm run preview`, where its URL renders "Post not found".

For Component 7, inspect the build output directly rather than the browser, since the
whole point is what a non-executing client receives:

- `dist/blog/eidos-an-architecture-for-cheap-code/index.html` contains the essay's title,
  its excerpt as both description and `og:description`, a canonical URL, and the essay
  body as text — verified by reading the file, not by viewing it.
- Every content route and static route has its own directory and `index.html`, each with
  a distinct title. No two pages share `<title>Alex Barclay</title>`.
- The draft scratch post has no directory in `dist/`, no `rss.xml` entry, and no
  `sitemap.xml` entry.
- `rss.xml` parses as valid XML and its item count matches the number of published posts.
- `dist/404.html` is the bare shell, and an unknown deep URL still boots the SPA under
  `npm run preview`.
- Client-side navigation between two posts changes `document.title`, confirming the
  React 19 head hoisting works and has not been shadowed by the prerendered tags.

## Risks

- **Category as a required field** breaks any post lacking it. Only one post exists and
  it is backfilled in this change; the risk is that a future post omits it and fails at
  runtime rather than at build. The deferred validation script is the answer if that
  ever happens twice.
- **`draft` is obscurity, not privacy** — stated in full under Component 2.
- **The prerender script duplicates routing knowledge.** It must know that a blog post
  lives at `/blog/<slug>` while `App.tsx` declares the same fact independently, so adding
  a route later means changing two files or shipping pages with no metadata. Accepted for
  six routes; the honest fix is generating routes from a shared manifest, which is
  Astro's Content Collections wearing a different hat and an argument for that migration
  when it comes.
- **Injected HTML is thrown away on every page load.** Harmless, but it means the
  prerendered text can silently drift from what React renders — the script could emit
  stale or wrong markup and no browser session would reveal it. Verification therefore
  reads `dist/` directly rather than trusting the rendered page.
