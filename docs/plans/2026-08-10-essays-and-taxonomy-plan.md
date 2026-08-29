# Essays, Taxonomy, and Crawlability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Eidos essay and its four-document specification on the portfolio site, with a category taxonomy, a draft state, and build-time metadata that makes the site crawlable and shareable.

**Architecture:** Markdown with YAML frontmatter stays the source of truth, loaded by `import.meta.glob` at runtime. The parsing half of the content module is extracted so a Node build script can reuse it, and that script generates a real HTML file per route after `vite build` — metadata for crawlers, with the SPA taking over for humans. The specification gets its own section rather than being dropped into the writing feed.

**Tech Stack:** React 19, TypeScript (strict), Vite 7, react-router-dom 7, marked, highlight.js, yaml, tsx (new).

**Design doc:** [`docs/plans/2026-08-10-essays-and-taxonomy-design.md`](2026-08-10-essays-and-taxonomy-design.md)

**Status:** Complete. All 15 tasks implemented and landed on `writing/main`; deployed to
<https://alexanderdbarclay.com/writing/> on 2026-08-11. Checkboxes below are retained as a
record of what shipped, not as remaining work.

## Global Constraints

- ~~**No test runner exists in this repo and this plan does not add one.**~~ **Superseded by Task 14,** which adds Vitest and a suite over the pure logic in `src/lib`. Tasks 1–13 were verified as this constraint describes: `npm run build` (which runs `tsc -b`, so type errors fail the build), `npm run lint`, and — where the deliverable is a file — reading that file. From Task 14 on, `npm run test` is also available and is the preferred check for anything in `src/lib`.
- **TypeScript strict mode is on, with `noUnusedLocals` and `noUnusedParameters`.** An unused import fails the build.
- **All styling is inline React style objects.** The only exception is `src/index.css`, which holds custom properties and now the `.prose` block. Do not introduce CSS modules, Tailwind, or styled-components.
- **No new runtime dependencies.** Exactly one new devDependency is authorised: `tsx`.
- **Canonical origin is `https://alexanderdbarclay.com`** with ~~base path `/` (a GitHub user page, so no repo-name prefix)~~ — **superseded by Task 15:** base path is `/writing`, because this is a Pages *project* site and the domain root belongs to the treatise. `BASE_PATH` in `src/lib/site.ts` is the single source of truth; `base` in `vite.config.ts` and the router's `basename` must agree with it.
- **Commit messages** use the repo's existing style (`feat:`, `fix:`, or a plain imperative sentence). Do **not** add `Co-Authored-By` lines or any "Generated with" attribution footer.
- **Branch:** all work lands on `feat/essays-and-taxonomy`, which already exists and already holds the design document.
- **Editorial rule for all content files:** the source documents arrived with UTF-8 misread as Latin-1. `â` stands for an em dash (—) except where noted, `â¦` for an ellipsis (…), and `Â§` for a section sign (§). The corrected text is given in full in Tasks 4 and 7 — copy it verbatim rather than re-deriving it.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/markdown.ts` | Pure markdown parsing: `marked`/`highlight.js` config, frontmatter split, slug rules. Importable from both Vite and plain Node. |
| `src/lib/frontmatter.ts` | The frontmatter shapes and the category taxonomy. Pure types plus one const, shared by the app and the build script so neither redeclares them. |
| `src/components/DraftBadge.tsx` | The dev-only DRAFT marker, used by both the card and the post page. |
| `src/lib/site.ts` | Site-wide constants (origin, title, author, default description and social image), shared by the app and the build script. |
| `src/components/CategoryFilter.tsx` | The chip row on the writing index. Presentational; owns no state. |
| `src/pages/Eidos.tsx` | Specification index page. |
| `src/pages/EidosDoc.tsx` | Single specification document, with sidebar and prev/next. |
| `scripts/prerender.ts` | Post-build static HTML, RSS, and sitemap generation. |
| `content/blog/2026-08-10-eidos-an-architecture-for-cheap-code.md` | The essay. |
| `content/eidos/01-architecture.md` … `04-infrastructure.md` | The specification. |

**Modified:**

| File | Change |
|---|---|
| `src/lib/content.ts` | Loses its parsing internals to `markdown.ts`; gains generic loaders, the category and draft schema, and the Eidos collection. |
| `src/pages/Blog.tsx` | Category and tag filtering driven by URL search params. |
| `src/pages/BlogPost.tsx` | `.prose` class, clickable tags, draft badge, head tags. |
| `src/pages/Projects.tsx`, `src/pages/ProjectDetail.tsx`, `src/pages/About.tsx`, `src/pages/Landing.tsx` | Head tags; `ProjectDetail` also gains `.prose`. |
| `src/components/BlogCard.tsx` | Clickable tags, draft badge. |
| `src/components/NavBar.tsx` | "Blog" → "Writing"; new Eidos entry. |
| `src/App.tsx` | Two new routes. |
| `src/index.css` | `.prose` block. |
| `package.json` | `tsx` devDependency; prerender wired into `build`. |
| `.github/workflows/deploy.yml` | Drop the `cp index.html 404.html` step. |
| `content/blog/2026-02-27-hello-world.md` | Backfill `category`; drop duplicate H1. |

---

### Task 1: Extract pure markdown parsing and collapse the loaders

A pure refactor. Behaviour must not change: the site renders identically before and after. This exists so that Task 11's Node script and the browser produce byte-identical HTML from the same source.

**Files:**
- Create: `src/lib/markdown.ts`
- Create: `src/lib/frontmatter.ts`
- Modify: `src/lib/content.ts` (whole file)

**Interfaces:**
- Consumes: nothing.
- Produces: `parseMarkdown<T>(raw: string): { frontmatter: T; html: string }`, `slugFromDatedPath(path: string): string`, `slugFromOrderedPath(path: string): string` from `src/lib/markdown.ts`; `BlogFrontmatter` and `ProjectFrontmatter` from `src/lib/frontmatter.ts`. `src/lib/content.ts` keeps its four existing exported functions and their exact signatures and the `ContentEntry<T>` type, and re-exports the frontmatter types so every page's existing import keeps working.

Two pure modules rather than one: `markdown.ts` is behaviour (it configures `marked` on import), `frontmatter.ts` is shape. Task 11's Node script needs the shapes without the parser's side effects, and neither may contain `import.meta`.

- [x] **Step 1: Create `src/lib/markdown.ts`**

Everything here must be free of `import.meta` — Node will import this file directly in Task 11.

```ts
import { parse as parseYaml } from 'yaml';
import { marked, type Tokens } from 'marked';
import hljs from 'highlight.js';

// Configure marked with syntax highlighting
marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }: Tokens.Code): string {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(text, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    },
  },
});

export function parseMarkdown<T>(raw: string): { frontmatter: T; html: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {} as T, html: marked.parse(raw) as string };
  }
  const frontmatter = parseYaml(match[1]) as T;
  const html = marked.parse(match[2]) as string;
  return { frontmatter, html };
}

/** `2026-08-10-my-post.md` -> `my-post` */
export function slugFromDatedPath(path: string): string {
  const filename = path.split('/').pop()!.replace(/\.md$/, '');
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

/** `01-architecture.md` -> `architecture` */
export function slugFromOrderedPath(path: string): string {
  const filename = path.split('/').pop()!.replace(/\.md$/, '');
  return filename.replace(/^\d+-/, '');
}
```

- [x] **Step 2: Create `src/lib/frontmatter.ts`**

Moved verbatim out of `content.ts`. Task 2 extends these, Task 8 adds a third, and Task 11 imports them instead of redeclaring them.

```ts
/**
 * The shapes of our content frontmatter. Pure types — shared by the app and by
 * scripts/prerender.ts, so keep this free of import.meta and of side effects.
 */

export interface BlogFrontmatter {
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
}

export interface ProjectFrontmatter {
  title: string;
  description: string;
  thumbnail?: string;
  tags: string[];
  date: string;
  links?: {
    github?: string;
    live?: string;
  };
}
```

- [x] **Step 3: Rewrite `src/lib/content.ts` against both**

Replace the entire file. The four exported functions keep their names, signatures, and behaviour — only their internals move. The `export type` line matters: pages import `BlogFrontmatter` from `./content` today, and this keeps that true.

```ts
import {
  parseMarkdown,
  slugFromDatedPath,
} from './markdown';
import type { BlogFrontmatter, ProjectFrontmatter } from './frontmatter';

export type { BlogFrontmatter, ProjectFrontmatter } from './frontmatter';

export interface ContentEntry<T> {
  slug: string;
  frontmatter: T;
  html: string;
}

type RawModules = Record<string, () => Promise<string>>;
type SlugFn = (path: string) => string;

async function loadAll<T>(modules: RawModules, slugFn: SlugFn): Promise<ContentEntry<T>[]> {
  const entries: ContentEntry<T>[] = [];
  for (const [path, loader] of Object.entries(modules)) {
    const raw = await loader();
    const { frontmatter, html } = parseMarkdown<T>(raw);
    entries.push({ slug: slugFn(path), frontmatter, html });
  }
  return entries;
}

async function loadOne<T>(
  modules: RawModules,
  slugFn: SlugFn,
  slug: string
): Promise<ContentEntry<T> | null> {
  for (const [path, loader] of Object.entries(modules)) {
    if (slugFn(path) === slug) {
      const raw = await loader();
      const { frontmatter, html } = parseMarkdown<T>(raw);
      return { slug, frontmatter, html };
    }
  }
  return null;
}

function byDateDesc<T extends { date: string }>(
  a: ContentEntry<T>,
  b: ContentEntry<T>
): number {
  return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();
}

const blogModules = import.meta.glob<string>('/content/blog/*.md', {
  query: '?raw',
  import: 'default',
});

const projectModules = import.meta.glob<string>('/content/projects/*.md', {
  query: '?raw',
  import: 'default',
});

export async function loadBlogPosts(): Promise<ContentEntry<BlogFrontmatter>[]> {
  const entries = await loadAll<BlogFrontmatter>(blogModules, slugFromDatedPath);
  return entries.sort(byDateDesc);
}

export async function loadBlogPost(slug: string): Promise<ContentEntry<BlogFrontmatter> | null> {
  return loadOne<BlogFrontmatter>(blogModules, slugFromDatedPath, slug);
}

export async function loadProjects(): Promise<ContentEntry<ProjectFrontmatter>[]> {
  const entries = await loadAll<ProjectFrontmatter>(projectModules, slugFromDatedPath);
  return entries.sort(byDateDesc);
}

export async function loadProject(slug: string): Promise<ContentEntry<ProjectFrontmatter> | null> {
  return loadOne<ProjectFrontmatter>(projectModules, slugFromDatedPath, slug);
}
```

- [x] **Step 4: Verify the build and lint pass**

Run: `npm run build && npm run lint`
Expected: both succeed. A failure here is almost certainly an unused import left behind in `content.ts` (`noUnusedLocals` is on) — `slugFromOrderedPath` is deliberately not imported yet and must not be.

- [x] **Step 5: Verify the site is unchanged**

Run: `npm run dev`, then open `http://localhost:5173/blog`, click through to the Hello World post, and open `/projects`.
Expected: identical to before — post list renders, post body renders with its code block highlighted, project list renders. No page imports were changed, so any import error means the re-export in Step 3 is missing.

- [x] **Step 6: Commit**

```bash
git add src/lib/markdown.ts src/lib/frontmatter.ts src/lib/content.ts
git commit -m "refactor: extract pure markdown parsing and frontmatter shapes"
```

---

### Task 2: Category taxonomy and draft state

**Files:**
- Modify: `src/lib/frontmatter.ts`
- Modify: `src/lib/content.ts`
- Modify: `content/blog/2026-02-27-hello-world.md`

**Interfaces:**
- Consumes: `parseMarkdown`, `slugFromDatedPath` from Task 1.
- Produces: `type Category = 'software' | 'fiction' | 'politics' | 'meta'`; `CATEGORIES: readonly { id: Category; label: string }[]`; `BlogFrontmatter` extended with `category: Category` and `draft?: boolean` — all in `src/lib/frontmatter.ts`, all re-exported from `src/lib/content.ts`. `loadBlogPosts()` and `loadBlogPost()` now hide drafts in production builds.

- [x] **Step 1: Add the category taxonomy to `src/lib/frontmatter.ts`**

Insert above the `BlogFrontmatter` interface:

```ts
export type Category = 'software' | 'fiction' | 'politics' | 'meta';

/** Display order of the filter chips. Adding a category is a change to these two lines. */
export const CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: 'software', label: 'Software' },
  { id: 'fiction', label: 'Fiction' },
  { id: 'politics', label: 'Politics' },
  { id: 'meta', label: 'Meta' },
];
```

- [x] **Step 2: Extend `BlogFrontmatter`, in the same file**

```ts
export interface BlogFrontmatter {
  title: string;
  date: string;
  excerpt: string;
  category: Category;
  tags: string[];
  draft?: boolean;
}
```

- [x] **Step 3: Re-export both from `src/lib/content.ts`**

`Category` is a type and `CATEGORIES` is a value, so they need different export forms. Add beside the existing re-export line:

```ts
export type { Category } from './frontmatter';
export { CATEGORIES } from './frontmatter';
```

- [x] **Step 4: Filter drafts in the two blog loaders**

Add above `loadBlogPosts`:

```ts
/**
 * Drafts are visible in the dev server and absent from production builds.
 * This hides them; it does not keep their text out of the bundle — see the
 * design doc, Component 2.
 */
const SHOW_DRAFTS = import.meta.env.DEV;
```

Then replace the two blog functions:

```ts
export async function loadBlogPosts(): Promise<ContentEntry<BlogFrontmatter>[]> {
  const entries = await loadAll<BlogFrontmatter>(blogModules, slugFromDatedPath);
  return entries.filter(e => SHOW_DRAFTS || !e.frontmatter.draft).sort(byDateDesc);
}

export async function loadBlogPost(slug: string): Promise<ContentEntry<BlogFrontmatter> | null> {
  const entry = await loadOne<BlogFrontmatter>(blogModules, slugFromDatedPath, slug);
  if (!entry) return null;
  if (!SHOW_DRAFTS && entry.frontmatter.draft) return null;
  return entry;
}
```

- [x] **Step 5: Backfill the existing post**

`category` is required, so the one existing post needs it. Replace the frontmatter block and remove the duplicate `# Hello World` heading — the page already renders `frontmatter.title` as the `<h1>`.

```markdown
---
title: "Hello World"
date: 2026-02-27
excerpt: "The first post on my new portfolio site."
category: meta
tags: ["meta"]
---

This is the first post on my new site. I'm rebuilding my portfolio as a hub
for my work across software engineering, machine learning, robotics, and
eventually game design.
```

Leave the rest of the file (from `## What's Coming` onward) exactly as it is.

- [x] **Step 6: Verify**

Run: `npm run build && npm run lint`
Expected: both pass.

Then create a throwaway draft to prove the filter works:

```bash
cat > content/blog/2026-08-10-draft-probe.md <<'EOF'
---
title: "Draft Probe"
date: 2026-08-10
excerpt: "Temporary file proving draft filtering works."
category: meta
tags: ["meta"]
draft: true
---

If you can read this in production, the draft filter is broken.
EOF
```

Run `npm run dev` and confirm "Draft Probe" appears at `/blog`. Then run `npm run build && npm run preview` and confirm it does **not** appear at `/blog`, and that `/blog/draft-probe` renders "Post not found".

Keep this file — Tasks 5 and 11 use it, and Task 13 deletes it.

- [x] **Step 7: Commit**

```bash
git add src/lib/frontmatter.ts src/lib/content.ts content/blog/2026-02-27-hello-world.md content/blog/2026-08-10-draft-probe.md
git commit -m "feat: add category taxonomy and draft state to blog content"
```

---

### Task 3: Prose styles for rendered markdown

The global reset sets `margin: 0` on every element and nothing restores it for `marked` output, so rendered paragraphs and headings currently have no spacing at all, list bullets sit outside their container, and tables render without borders. The existing post is short enough to have concealed this. Fix it before publishing 2,300 words.

**Files:**
- Modify: `src/index.css` (append)
- Modify: `src/pages/BlogPost.tsx:65-68`
- Modify: `src/pages/ProjectDetail.tsx` (the `<article>` element)

**Interfaces:**
- Consumes: nothing.
- Produces: a `.prose` class, applied to every `<article>` that renders markdown. Task 9's `EidosDoc.tsx` will use it too.

- [x] **Step 1: Append the `.prose` block to `src/index.css`**

Uses only existing custom properties; adds no tokens and no font changes.

```css
/* Rendered markdown. The global reset zeroes margins, so everything
   marked() emits needs its spacing restored explicitly. */
.prose {
  line-height: 1.8;
  color: var(--color-text);
}

.prose > * + * {
  margin-top: 1.25em;
}

.prose h2,
.prose h3,
.prose h4 {
  line-height: 1.3;
  font-weight: 600;
  margin-top: 2.5em;
  margin-bottom: -0.25em;
}

.prose h2 {
  font-size: 1.5rem;
}

.prose h3 {
  font-size: 1.2rem;
}

.prose h4 {
  font-size: 1.05rem;
  color: var(--color-text-muted);
}

.prose ul,
.prose ol {
  padding-left: 1.5em;
}

.prose li + li {
  margin-top: 0.4em;
}

.prose blockquote {
  border-left: 2px solid var(--color-accent-dim);
  padding-left: 1.25em;
  color: var(--color-text-muted);
  font-style: italic;
}

.prose hr {
  border: none;
  border-top: 1px solid var(--color-gear-stroke);
  margin: 3em 0;
}

.prose table {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.prose th,
.prose td {
  border: 1px solid var(--color-gear-stroke);
  padding: 0.5em 0.75em;
  text-align: left;
  vertical-align: top;
}

.prose th {
  font-weight: 600;
  background: rgba(255, 255, 255, 0.03);
}

.prose strong {
  font-weight: 600;
  color: #f0f2f6;
}

.prose a {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
```

`display: block` plus `overflow-x: auto` on the table is what stops the specification's wide tables from forcing the whole page to scroll sideways on a phone.

- [x] **Step 2: Apply it in `src/pages/BlogPost.tsx`**

Replace the `<article>` element:

```tsx
      <article
        className="prose"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
```

The inline `style={{ lineHeight: 1.8, color: 'var(--color-text)' }}` goes away — `.prose` now carries both.

- [x] **Step 3: Apply it in `src/pages/ProjectDetail.tsx`**

Find the `<article>` that renders `project.html` and give it `className="prose"`, removing any inline `lineHeight`/`color` style that duplicates what `.prose` sets. Leave every other style in that file alone.

- [x] **Step 4: Verify**

Run: `npm run build && npm run lint`, then `npm run dev`.
Expected: at `/blog/hello-world`, paragraphs are separated, `## What's Coming` has space above it, the bulleted list is indented with visible bullets, and the code block still highlights. At `/projects/portfolio-site`, the body is spaced and nothing else about the page has shifted.

- [x] **Step 5: Commit**

```bash
git add src/index.css src/pages/BlogPost.tsx src/pages/ProjectDetail.tsx
git commit -m "fix: restore prose styles for rendered markdown"
```

---

### Task 4: Publish the essay

**Files:**
- Create: `content/blog/2026-08-10-eidos-an-architecture-for-cheap-code.md`

**Interfaces:**
- Consumes: the `BlogFrontmatter` shape from Task 2 (`category` is required).
- Produces: a post at `/blog/eidos-an-architecture-for-cheap-code`, and the first entry in the writing feed.

Three transformations were applied to the source and are already baked into the text below — do not re-apply them, and do not "improve" the prose in any other way:

1. The `# Eidos: An Architecture for Cheap Code` heading is gone; the page renders `frontmatter.title` as the `<h1>`.
2. The `*Draft v4 — publication critique applied…*` line is gone; it records how the draft was revised and is not part of the essay.
3. The closing bracket — `*[The specification, and the systems that demonstrate it, continue from here.]*` — is now a real link to `/eidos`, keeping the author's words and replacing only the bracket.

- [x] **Step 1: Create the file with exactly this content**

```markdown
---
title: "Eidos: An Architecture for Cheap Code"
date: 2026-08-10
excerpt: "For fifty years, software architecture has argued about where the boundaries should go, on the shared premise that a human's attention is the scarce resource. That premise no longer holds."
category: software
tags: ["architecture", "ai", "philosophy"]
---

For roughly fifty years, the central question of software architecture has been where the boundaries should go, and the answers have differed in vocabulary considerably more than in substance. By a boundary I mean something specific: a line in the codebase that changes are not permitted to cross freely — a module that may not import another, a layer that may not know what sits above it, an interface behind which the implementation is nobody else's business. David Parnas argued in 1972 that we should draw these lines around whatever is likely to change, hiding each volatile decision behind an interface so its blast radius stays contained. The Gang of Four gave that instinct a pattern catalog. Robert Martin scaled it up into concentric rings and called it Clean Architecture — dependencies point inward, toward the stable business rules, and away from the volatile frameworks and databases at the edge. Hexagonal, Onion: restatements of the same two ideas in different costume. Manage your dependencies, and decompose by rate of change.

The dissenters, to their credit, were arguing about the same thing from the other side. The Rails school — David Heinemeier Hansson's "omakase" position, that a framework's opinions should be accepted the way one accepts a chef's menu — held that the framework is the architecture, and that the abstraction insurance Clean Architecture sells is a premium paid daily against a fire that rarely comes, since nobody actually swaps their database. John Ousterhout, in *A Philosophy of Software Design*, observed that complexity comes from shallow abstractions rather than impure ones — interfaces whose cost to learn approaches the value of what they hide — and that a pass-through layer, an interface with one implementation, a DTO mapped between two identical shapes, is cost without benefit. The vertical-slice camp noted that most changes are feature-scoped, so organizing by layer guarantees that each change touches five files across five directories. These critiques are worth taking seriously, and I largely do. But it's worth noticing that they share a premise with the philosophies they criticize: that the scarce resource is a human's attention, and that the architecture's job is to spend that attention well.

As of quite recently, that premise no longer holds, and the consequences are worth working through carefully.

## What cheap code changes

Large language models have made code production nearly free. This inverts the cost–benefit ledger of every architecture philosophy at once, though not uniformly, and the details matter. Three observations follow, and the argument of this essay is that a particular architecture falls out of them.

The first observation concerns enforcement. Consider an agent asked to add a discount feature to a web application. Somewhere in the repository is a rule — controllers must not query the database directly; that work belongs to the service layer. If that rule lives in a CONTRIBUTING.md the agent was never shown, or in the review instincts of a senior engineer who now approves forty agent-authored pull requests a week, the agent will violate it, the query will work, the tests will pass, and the boundary will quietly cease to exist. If instead the rule is an import-linter contract — a machine-checked declaration that the controllers package may not import the persistence package — the build fails, the agent reads the error, and it routes the query through the service layer, not out of good citizenship but because that was the only path that compiled. The rule is identical in both cases. The difference is that one of them exists. Prose guidelines were always a weak enforcement mechanism; they become a dead letter when the author of most changes generates faster than humans can review.

The second observation concerns convention. A framework with strong opinions means less context is required to make a correct change — and the agent has seen a million codebases that share those opinions. Convention-over-configuration was designed to make any Rails developer productive in any Rails app; it has, somewhat accidentally, optimized for making any model productive in any Rails app. The philosophies that suffer are the ones in the middle: bespoke, semi-principled structures that are neither conventional enough for a model to pattern-match nor mechanical enough to reject violations automatically. A hand-rolled, clean-ish architecture that lives in a senior engineer's head is close to the worst possible input one can hand a coding agent. The agent cannot read anyone's mind, and it does not attend code review as a learner.

The third observation concerns design, and it is here that some vocabulary becomes necessary. Ousterhout's deep module — a large volume of implementation behind a small, carefully designed interface — turns out to be a nearly ideal unit of work for an agent: minimal surface area to understand, internals hidden, behavior lockable with tests at the boundary. Designing deep modules, however, requires precisely the judgment models remain weakest at. So the labor divides: humans design the durable thing — the interface, its invariants, the decisions deliberately hidden behind it — and agents produce implementations of it, cheaply and repeatedly. I want a name for that durable, human-designed thing, because the rest of this essay is about it. I'll call it a Form: it is what stays real about the system while implementations come and go, and an implementation is correct exactly insofar as it conforms to it. The reader who hears Plato in that word is hearing correctly, and I'll return to why.

## The synthesis

Each of the three observations demands a commitment, and the three commitments together are the architecture.

From the second observation, maximal convention. Prefer the boring, well-trodden way of doing things, because the contributor writing most of the code has a prior trained on millions of repositories, and that prior does free work wherever the codebase matches it. Structural novelty is now a cost paid on every change, indefinitely, and should be treated accordingly.

From the first observation, mechanical enforcement. Any rule that matters must fail deterministically. The established name for such a check is an architectural fitness function — Neal Ford, Rebecca Parsons, and Patrick Kua's term, from *Building Evolutionary Architectures*, for an assessment of an architectural characteristic. Their definition admits manual checks; Eidos adopts the term in its strictest form — automated, deterministic, blocking. A compile error, a lint rule, a dependency-graph assertion, a CI gate: if a boundary is not guarded by one of these, it is not a boundary. It is a suggestion, and suggestions do not survive contact with an agent working in a loop.

From the third observation, human-designed seams. Michael Feathers gave us the word seam — a place where behavior can be altered without editing the code at that place — and the seams are where the Forms live. Deciding where they go, which interfaces are load-bearing, which decisions get hidden: this is the remaining irreducibly human work, promoted from style advice to something closer to the senior engineer's primary job description. Humans author the Forms; agents fill them; fitness functions verify the fit.

None of these ideas is new, and I want to be careful not to claim otherwise — the lineages run through Parnas, Feathers, Ford, Ousterhout, and the Rails school in roughly equal measure. What is new is the claim that this particular arrangement of them is not a style preference but a response to a changed economy. The winning architecture is no longer the one with the best arguments. It is the one where correctness is cheapest to verify.

## What would make this wrong

Before planting anything, I should say what would falsify the argument, because two of its parts are more dated than they look.

The first vulnerability is overhead. Eidos asks for artifacts — Form documents, gate registries, checks that verify the registry itself — and overhead is exactly how Clean Architecture's ceremony began: as guardrails somebody argued were worth their cost. If the documents come to outnumber the invariants they guard, Eidos will have failed in the same way its predecessor did, with better vocabulary. The discipline has to be enforced against itself: a Form with no fitness function behind it is the old disease returning, and should be deleted on sight.

The second vulnerability is that maximal convention rests on an empirical claim about models — that conventional structure is cheaper for them to work in than bespoke structure — which is true today, and measurably, but is a fact about the current generation of models rather than a law. If context handling improves to the point that a model reads an idiosyncratic codebase as fluently as a conventional one, the convention argument decays into ordinary taste. I would note that mechanical enforcement survives both failures — verification stays cheap to demand no matter who writes the code or how well they read — which is why this essay leans hardest on it. But the reader deserves to know which parts of the argument are load-bearing and which are dated.

## Planting the flag

This synthesis is currently being rediscovered, independently and in fragments, across the industry. One practitioner writes about designing module seams so the implementation inside can be delegated to AI. Another team encodes architectural rules into a build graph so they fail deterministically rather than living in reviewers' heads. A third has begun cataloging practices under the banner of "Agent Experience," a deliberate echo of DX. The terms multiply — agent-native, agent-ready, agent-friendly — but none has stuck: no book, no canonical diagram, no name the industry has agreed to.

That vacuum will not last. Clean Architecture did not defeat Hexagonal and Onion on merit; the three are close to isomorphic. It won, as best I can tell, on a name, a diagram, and an author willing to plant a flag. The same window is open now, and it is closing.

So I'm calling it Eidos.

The name is Plato's word for Form, and the metaphor has been doing quiet work throughout this essay. The Form — the human-designed interface, its invariants, its hidden decisions — is what is real about the system. Implementations are material copies of it, produced by a craftsman who is capable, tireless, and fallible. Plato had a name for that craftsman: the demiurge of the *Timaeus*, who builds the world by copying the Forms as faithfully as the material allows. It took the Gnostics, centuries later, to conclude that the craftsman was flawed and his copies could not be taken on faith. Software has arrived at the economy this metaphysics describes: the Form endures and is expensive, the copies are cheap and disposable, and the measuring — the fitness functions, the gates — is the entire difference between a philosophy and a hope.

*The specification, and the systems that demonstrate it, [continue here](/eidos).*
```

- [x] **Step 2: Verify no mojibake survived**

Run: `grep -n 'â' content/blog/2026-08-10-eidos-an-architecture-for-cheap-code.md`
Expected: no output. Any hit means a dash was pasted from the raw source instead of this plan.

- [x] **Step 3: Verify it renders**

Run: `npm run build && npm run dev`
Expected: the essay is the top entry at `/blog`; `/blog/eidos-an-architecture-for-cheap-code` renders with a single `<h1>`, spaced paragraphs, and italics intact. The `/eidos` link at the foot will 404 until Task 9 — that is expected.

- [x] **Step 4: Commit**

```bash
git add content/blog/2026-08-10-eidos-an-architecture-for-cheap-code.md
git commit -m "content: publish Eidos essay"
```

---

### Task 5: Draft badge and clickable tags

**Files:**
- Create: `src/components/DraftBadge.tsx`
- Create: `src/lib/dates.ts`
- Modify: `src/components/BlogCard.tsx`
- Modify: `src/pages/BlogPost.tsx`
- Modify: `src/components/ProjectCard.tsx`
- Modify: `src/pages/ProjectDetail.tsx`

**Interfaces:**
- Consumes: `BlogFrontmatter.draft` from Task 2.
- Produces: `<DraftBadge draft={…} />`, which renders nothing outside the dev server; `formatDate(value: string | Date): string`; and tag links of the form `/blog?tag=<tag>`, which Task 6's filter reads.

- [x] **Step 0: Fix the off-by-one date bug**

Found by rendering the built site: a post dated `2026-08-10` displays as "August 9, 2026", and `2026-02-27` displays as "February 26". Every date on the site is wrong by a day for any reader west of Greenwich, including the essay's publication date.

The cause is that `new Date('2026-08-10')` is parsed as UTC midnight, and `toLocaleDateString()` then renders it in the viewer's local zone, landing on the previous evening. The frontmatter values are calendar days, not instants, so they must be formatted in UTC.

Create `src/lib/dates.ts`:

```ts
/**
 * Frontmatter dates are calendar days. `new Date('2026-08-10')` parses to UTC
 * midnight, so formatting in local time renders the previous day anywhere west
 * of Greenwich. Formatting in UTC is what keeps the printed date the authored one.
 *
 * The parameter accepts Date because the YAML parser resolves unquoted
 * `2026-08-10` to a Date, not a string, despite the frontmatter types.
 */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(value instanceof Date ? value : new Date(value));
}
```

Then replace the inline date formatting in all four components that render one. Each currently reads roughly:

```tsx
        {new Date(frontmatter.date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })}
```

and becomes:

```tsx
        {formatDate(frontmatter.date)}
```

The four files are `src/components/BlogCard.tsx`, `src/pages/BlogPost.tsx` (which uses `post.frontmatter.date`), `src/components/ProjectCard.tsx`, and `src/pages/ProjectDetail.tsx` (which uses `project.frontmatter.date`). Add `import { formatDate } from '../lib/dates';` to each — the path is `'../lib/dates'` from both `components/` and `pages/`. Change nothing else in the two project files.

Commit this separately, before the rest of the task:

```bash
git add src/lib/dates.ts src/components/BlogCard.tsx src/pages/BlogPost.tsx src/components/ProjectCard.tsx src/pages/ProjectDetail.tsx
git commit -m "fix: format frontmatter dates in UTC so they render the authored day"
```

Tags become links **on the post page only**. `BlogCard`'s entire card is already a `<Link>`, and an anchor inside an anchor is invalid HTML that React will render but browsers handle inconsistently. Card tags stay as static spans; the chip row from Task 6 is how filtering is discovered from the index.

- [x] **Step 1: Create `src/components/DraftBadge.tsx`**

The badge appears in two places with the same styling, and it owns one rule — never render in production — that must not be stated twice.

```tsx
interface Props {
  draft?: boolean;
  /** Spacing below the badge; differs between the card and the post header. */
  marginBottom?: string;
}

/** Dev-only marker so a draft read in `npm run dev` is never mistaken for live. */
export default function DraftBadge({ draft, marginBottom = '0.5rem' }: Props) {
  if (!import.meta.env.DEV || !draft) return null;

  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: '#0f1117',
      background: 'var(--color-accent)',
      padding: '0.1rem 0.4rem',
      borderRadius: '3px',
      marginBottom,
    }}>
      DRAFT
    </span>
  );
}
```

- [x] **Step 2: Use it in both places**

In `src/components/BlogCard.tsx`, add `import DraftBadge from './DraftBadge';` and place this immediately above the `<time>` element, inside the `<Link>`:

```tsx
      <DraftBadge draft={frontmatter.draft} />
```

In `src/pages/BlogPost.tsx`, add `import DraftBadge from '../components/DraftBadge';` and place this immediately above the `<time>` element:

```tsx
      <DraftBadge draft={post.frontmatter.draft} marginBottom="0.75rem" />
```

- [x] **Step 3: Make the post page's tags links**

Replace the tag `<span>` block in `src/pages/BlogPost.tsx` with:

```tsx
          {post.frontmatter.tags.map(tag => (
            <Link
              key={tag}
              to={`/blog?tag=${encodeURIComponent(tag)}`}
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-accent)',
                background: 'var(--color-accent-dim)',
                padding: '0.15rem 0.5rem',
                borderRadius: '3px',
              }}
            >
              {tag}
            </Link>
          ))}
```

`Link` is already imported in this file.

- [x] **Step 4: Verify**

Run: `npm run build && npm run lint`, then `npm run dev`.
Expected: "Draft Probe" carries a gold DRAFT badge on the index and on its own page. On the essay, the three tags are clickable and navigate to `/blog?tag=architecture` (which will not filter anything until Task 6 — the URL changing is what matters here). Run `npm run build && npm run preview` and confirm no badge appears anywhere.

- [x] **Step 5: Commit**

```bash
git add src/components/DraftBadge.tsx src/components/BlogCard.tsx src/pages/BlogPost.tsx
git commit -m "feat: add draft badge and clickable post tags"
```

---

### Task 6: Category filtering on the writing index

**Files:**
- Create: `src/components/CategoryFilter.tsx`
- Modify: `src/pages/Blog.tsx` (whole file)
- Modify: `src/components/NavBar.tsx:3-7`

**Interfaces:**
- Consumes: `CATEGORIES`, `Category` from Task 2; tag links from Task 5.
- Produces: `/blog?category=<id>` and `/blog?tag=<tag>` as filterable, shareable URLs. Nothing later depends on this task.

- [x] **Step 1: Create `src/components/CategoryFilter.tsx`**

Purely presentational — it holds no state and does not touch the URL.

```tsx
import { CATEGORIES, type Category } from '../lib/content';

interface Props {
  counts: Partial<Record<Category, number>>;
  active: Category | null;
  total: number;
  onSelect: (category: Category | null) => void;
}

const chipStyle = (selected: boolean): React.CSSProperties => ({
  fontSize: '0.8rem',
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '0.3rem 0.7rem',
  borderRadius: '999px',
  cursor: 'pointer',
  background: selected ? 'var(--color-accent-dim)' : 'transparent',
  color: selected ? 'var(--color-accent)' : 'var(--color-text-muted)',
  border: `1px solid ${selected ? 'var(--color-accent-dim)' : 'var(--color-gear-stroke)'}`,
  transition: 'color 0.2s, background 0.2s, border-color 0.2s',
});

export default function CategoryFilter({ counts, active, total, onSelect }: Props) {
  // Only categories that actually have posts get a chip, so the taxonomy can be
  // declared ahead of the writing without advertising empty rooms.
  const present = CATEGORIES.filter(c => (counts[c.id] ?? 0) > 0);
  if (present.length < 2) return null;

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
      <button type="button" style={chipStyle(active === null)} onClick={() => onSelect(null)}>
        All ({total})
      </button>
      {present.map(c => (
        <button
          type="button"
          key={c.id}
          style={chipStyle(active === c.id)}
          onClick={() => onSelect(c.id)}
        >
          {c.label} ({counts[c.id]})
        </button>
      ))}
    </div>
  );
}
```

- [x] **Step 2: Rewrite `src/pages/Blog.tsx`**

Filter state lives in the URL so a filtered view is shareable and survives reload.

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  loadBlogPosts,
  CATEGORIES,
  type Category,
  type ContentEntry,
  type BlogFrontmatter,
} from '../lib/content';
import BlogCard from '../components/BlogCard';
import CategoryFilter from '../components/CategoryFilter';

function asCategory(value: string | null): Category | null {
  return CATEGORIES.some(c => c.id === value) ? (value as Category) : null;
}

export default function Blog() {
  const [posts, setPosts] = useState<ContentEntry<BlogFrontmatter>[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCategory = asCategory(searchParams.get('category'));
  const activeTag = searchParams.get('tag');

  useEffect(() => {
    loadBlogPosts().then(p => { setPosts(p); setLoading(false); });
  }, []);

  // The tag filter narrows the pool the chips describe, so their counts always
  // match what clicking them would actually show.
  const pool = useMemo(
    () => (activeTag ? posts.filter(p => p.frontmatter.tags.includes(activeTag)) : posts),
    [posts, activeTag]
  );

  const counts = useMemo(() => {
    const result: Partial<Record<Category, number>> = {};
    for (const post of pool) {
      const c = post.frontmatter.category;
      result[c] = (result[c] ?? 0) + 1;
    }
    return result;
  }, [pool]);

  const visible = activeCategory
    ? pool.filter(p => p.frontmatter.category === activeCategory)
    : pool;

  function selectCategory(category: Category | null) {
    const next = new URLSearchParams(searchParams);
    if (category) next.set('category', category);
    else next.delete('category');
    setSearchParams(next, { replace: true });
  }

  return (
    <div style={{ padding: '6rem 2rem 2rem', maxWidth: '48rem', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>Writing</h1>

      {activeTag && (
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Tagged &ldquo;{activeTag}&rdquo; &middot;{' '}
          <Link to="/blog">clear</Link>
        </p>
      )}

      {!loading && (
        <CategoryFilter
          counts={counts}
          active={activeCategory}
          total={pool.length}
          onSelect={selectCategory}
        />
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : visible.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Nothing here yet. <Link to="/blog">Show everything</Link>
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {visible.map(post => (
            <BlogCard key={post.slug} slug={post.slug} frontmatter={post.frontmatter} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 3: Relabel the nav entry in `src/components/NavBar.tsx`**

The route is unchanged; only the label moves, because "Blog" describes a feed carrying fiction and political writing poorly.

```tsx
const links = [
  { to: '/blog', label: 'Writing' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];
```

- [x] **Step 4: Relabel it in `src/pages/Landing.tsx` too**

The landing page keeps its own copy of the nav list, so changing only `NavBar` leaves the two disagreeing.

```tsx
const navItems = [
  { to: '/blog', label: 'Writing' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];
```

- [x] **Step 5: Verify**

Run: `npm run build && npm run lint`, then `npm run dev`.
Expected at `/blog`:
- The heading and nav both read "Writing".
- Chips read `All (3) · Software (1) · Meta (2)` in dev (Hello World and Draft Probe are `meta`).
- Clicking Software sets `?category=software` and leaves one post; reloading the page keeps the filter.
- From the essay, clicking the `architecture` tag lands on `/blog?tag=architecture`, showing one post and a "Tagged" line with a working clear link.
- Setting both — `/blog?category=meta&tag=architecture` — shows the empty state with a working "Show everything" link.

- [x] **Step 6: Commit**

```bash
git add src/components/CategoryFilter.tsx src/pages/Blog.tsx src/components/NavBar.tsx src/pages/Landing.tsx
git commit -m "feat: filter writing index by category and tag via URL params"
```

---

### Task 7: The specification documents

**Files:**
- Create: `content/eidos/01-architecture.md`
- Create: `content/eidos/02-adoption.md`
- Create: `content/eidos/03-form-template.md`
- Create: `content/eidos/04-infrastructure.md`

**Interfaces:**
- Consumes: nothing (plain files).
- Produces: four documents with `title`, `order`, `version`, and `summary` frontmatter, which Task 8 loads and Task 9 renders.

Four transformations are already baked into the text below. Copy it verbatim:

1. The `#` heading and the `**… — v0.2**` subtitle are gone; `title` and `version` carry them, and the horizontal rule that followed is gone with them.
2. Mojibake restored: `â` → em dash, `â¦` → `…`, `Â§` → `§`, and the two occurrences of `registry â enforcement parity` → `registry ↔ enforcement parity`.
3. Cross-references that named source filenames now link to routes: `03-FORM-TEMPLATE.md` → `/eidos/form-template`, `04-INFRASTRUCTURE.md` → `/eidos/infrastructure`. Left as filenames they would point at files that no longer exist under those names.
4. Nothing else changed.

- [x] **Step 1: Create `content/eidos/01-architecture.md`**

````markdown
---
title: "Eidos Architecture"
order: 1
version: "0.2"
summary: "The canonical specification: Forms and implementations, the three commitments, the vocabulary, and the conformance levels that measure a repository against them."
---

*(v0.2: vocabulary settled — Eidos and Form are the only coined terms; established terminology reused and credited elsewhere.)*

## Thesis

When code production is cheap and most changes are written by machines, the winning architecture is not the one with the best arguments. It is the one where correctness is cheapest to verify.

Eidos Architecture holds that a software system consists of two kinds of material with different owners:

- **Forms** — the durable, human-designed structure: an interface, its invariants, and the decisions deliberately hidden behind it. Forms are what is *real* about the system. They change slowly and deliberately, and a human owns every one.
- **Implementations** — the code that fills the Forms: function bodies, glue, tests, configuration. Implementations are cheap, regenerable, and increasingly agent-written. An implementation is correct exactly insofar as it conforms to its Form.

A Form without enforcement is a suggestion. Therefore every Form is guarded by **fitness functions** (Ford, Parsons & Kua, *Building Evolutionary Architectures*): deterministic, automated checks that reject nonconforming implementations — a compile error, a lint rule, a dependency-graph assertion, a CI gate. If no machine can reject a violation, the Form does not exist.

Forms live at **seams** (Feathers, *Working Effectively with Legacy Code*): the places where behavior can be altered without editing code at that place. Agents fill the implementations; they are capable, tireless, and fallible — which is precisely why the fitness functions exist. Trust an agent to fill volume; never trust it to hold a boundary.

## The Three Commitments

### 1. Maximal Convention

Prefer the boring, corpus-dense way of doing everything. The primary contributor to your codebase has a prior trained on millions of repositories; every place your structure matches that prior, understanding is free. Every place it deviates, you pay a context tax on every change, forever.

**Rules:**
- Use the framework's blessed structure. Do not invent a folder layout the framework did not ask for.
- When two designs are close in merit, choose the one with more tutorial coverage.
- Novelty must be justified in writing, in the Form registry, with the misfit it resolves named explicitly.

### 2. Mechanical Enforcement

Any rule that matters must fail deterministically. Prose guidelines, review-comment culture, and tribal memory are dead letters when the author of most changes generates faster than humans can review.

**Rules:**
- Every architectural boundary is encoded as a fitness function (type system > build graph > lint/static analysis > CI script > hook, in order of preference — earlier is cheaper).
- A rule that exists only in a document is a defect. File it as such.
- Fitness functions fail loudly and block. No warnings-only mode; a warning is prose with extra steps.
- The gate registry (see [Form Template & Gate Registry](/eidos/form-template)) is the single source of truth for what is enforced and where.

### 3. Human-Designed Seams

The irreducibly human work is deciding where the boundaries go. Humans author deep modules (Ousterhout): small, carefully designed interfaces hiding large volumes of implementation. Agents fill the volumes.

**Rules:**
- Every module of consequence has a written Form: its interface, its invariants, its hidden decisions, and the fitness functions that guard it.
- Interfaces are designed for regenerability: the implementation behind a Form should be safely rewritable from scratch by an agent using only the Form and its locked-down tests.
- Changing a Form is an event: it requires a human decision, a written rationale, and a migration of its gates. Changing an implementation is routine and requires only that the gates pass.

## Vocabulary

Eidos coins two terms and borrows the rest, with credit:

| Term | Status | Meaning | Concrete artifact |
|---|---|---|---|
| **Eidos** | coined | The philosophy itself | This document |
| **Form** | coined | A human-designed boundary: interface + invariants + hidden decisions | A Form document (`forms/<name>.md`) + the interface code it describes |
| **Fitness function** | borrowed (Ford, Parsons & Kua) | A deterministic automated check guarding a Form | Type constraint, lint rule, dep-graph assertion, CI gate, hook |
| **Seam** | borrowed (Feathers) | The location where a Form separates two bodies of implementation | Module boundary, service boundary, layer edge |
| **Deep module** | borrowed (Ousterhout) | Small interface, large hidden implementation — the preferred shape of a Form | — |
| **Agent** | common usage | A code-producing model working from Forms | Claude Code session, CI agent, pipeline stage |

## Conformance Levels

A repository's Eidos conformance is measured, not asserted:

- **E0 — Prose.** Architecture exists in heads and documents only. No mechanical enforcement.
- **E1 — Gated.** CI blocks at least one class of architectural violation (dependency direction, layer access, doc staleness).
- **E2 — Formed.** Every load-bearing module has a written Form with at least one fitness function. The gate registry exists and CI verifies registry ↔ enforcement parity.
- **E3 — Regenerable.** Any single module's implementation can be deleted and regenerated by an agent from its Form and tests, passing every gate, without human authorship. This is the philosophy's end state and its acid test.

## What Eidos Is Not

- **Not Clean Architecture.** Eidos keeps the guardrails but discards the ceremony: no interface without a fitness function behind it, no layer that exists for purity. A pass-through abstraction with no enforced invariant is an implementation cosplaying as a Form — delete it.
- **Not vibe coding.** Regenerability is earned through Forms and gates, not hoped for.
- **Not framework-agnostic.** Eidos is deliberately framework-coupled (Commitment 1). The framework's conventions are inherited Forms — you adopt them instead of writing them.
- **Not documentation-driven.** Documents that no machine reads or verifies are E0 material. Eidos documents exist to be consumed by agents at task start and verified by gates at task end.

## Provenance

Eidos is an arrangement of known ideas for a new economy, and claims novelty only for the arrangement. The lineages: Parnas's information hiding (1972) for what a Form conceals; Feathers's seams for where Forms live; Ousterhout's deep modules for their shape; Ford, Parsons & Kua's fitness functions for how they're guarded; and the Rails school's convention-over-configuration for everything a Form need not say. The name is Plato's word for Form, and the metaphor is meant seriously: the Form is what endures; implementations are copies produced by a capable, fallible craftsman — the demiurge of the *Timaeus*, who copies the Forms as faithfully as the material allows; it took the Gnostics, centuries later, to conclude his copies could not be taken on faith — and because the craftsman is fallible, every copy is measured against the Form by rule rather than accepted on trust.
````

- [x] **Step 2: Create `content/eidos/02-adoption.md`**

````markdown
---
title: "Adopting Eidos"
order: 2
version: "0.2"
summary: "The playbook for existing projects: assessment, a first gate, forming the load-bearing modules, regenerability drills, and the anti-patterns that undo all four."
---

## The order of operations

Adoption is incremental and always in the same order: **find the seams — write the Forms — build the fitness functions — then, and only then, delegate the implementations.** Teams fail by inverting this — delegating heavily to agents first, then discovering their architecture was prose all along.

## Phase 0 — Assessment (one session per repo)

Answer these in writing; the answers become the seed of the Form registry.

1. **What is already conventional?** List everything the framework or ecosystem already decided (folder layout, naming, DI, routing). These are inherited Forms — free, already enforced by the framework. Do not re-document them; reference them.
2. **What is load-bearing and bespoke?** List the modules where a wrong change is expensive: money movement, auth, state machines, published APIs, data migrations. These need authored Forms first.
3. **What rules currently live in prose or heads?** Every "we always…" or "never…" a maintainer would say in review. Each is either promoted to a fitness function or deliberately dropped. There is no third state.
4. **What is the current conformance level?** Almost every repo starts at E0 or E1. Be honest; the level is a measurement.

## Phase 1 — First gate (target: E1, one day)

Ship one deterministic architectural gate before writing any Form documents. This proves the enforcement channel works and establishes the pattern.

Good first fitness functions, by ecosystem:

- **Dependency direction:** dependency-cruiser (JS/TS), import-linter (Python), ArchUnit (JVM), a SwiftLint custom rule or a build-graph assertion (iOS).
- **Boundary visibility:** package/module access modifiers enforced in CI; Bazel-style visibility if the build system supports it.
- **Doc-code parity:** a staleness audit that fails CI when a Form's interface drifts from its document (Atlas's `audit_staleness.py` pattern generalizes here).

The gate must **block**, not warn. Wire it into CI and, where the execution environment supports it, into hooks so agents hit the wall locally before CI does.

## Phase 2 — Form the load-bearing modules (target: E2)

For each module from Assessment item 2, in risk order:

1. Write its Form using the [Form template](/eidos/form-template): interface, invariants, hidden decisions, gates.
2. For every invariant, either build a fitness function or write down why one is impossible. "Impossible" should be rare and embarrassing.
3. Lock the boundary with tests at the interface — behavior tests an agent cannot game by editing internals.
4. Register the Form in `forms/registry.md` and add a CI check that every registered gate actually exists and runs (registry ↔ enforcement parity).

Do not Form everything. Implementations that are cheap to regenerate and low-blast-radius (view code, scripts, glue) stay unformed on purpose. Over-Forming is Clean Architecture ceremony returning through the back door.

## Phase 3 — Regenerability drills (target: E3)

Pick one Formed module per month and run the acid test: delete its implementation, hand an agent the Form and the tests, and see whether the regenerated implementation passes every gate without human authorship.

Every failure is a defect in the Form, not the agent: an undocumented invariant, an interface leaking hidden decisions, a missing fitness function. Fix the Form, re-run. A module that survives the drill is E3; a system whose load-bearing modules all survive is done adopting and starts compounding.

## Anti-patterns

- **Prose promotion theater.** Writing beautiful Form documents with no fitness functions behind them. That's E0 with better typography.
- **Warning-level rules.** A warning is a gate that has already decided to lose.
- **Forming the volatile edge.** UI experiments and prototypes churn too fast to Form. Form the seams *around* them instead.
- **Agent-authored Forms.** Agents may draft, but a human owns every Form decision. Delegating seam design to the entity that will be constrained by it defeats the design.
- **Registry drift.** A registry that claims gates that no longer run is worse than no registry — it teaches agents the documents lie. The parity check is itself a mandatory gate.

## Sequencing across a portfolio

For a multi-project portfolio, adopt in this order:

1. **The pipeline projects first** (anything that itself runs agents — requirements-to-code pipelines, orchestration platforms). These multiply every downstream benefit and every downstream defect.
2. **Infrastructure second** (see [Eidos for Infrastructure](/eidos/infrastructure)) — infra has the best natural fitness-function story of any domain and the worst consequences for drift.
3. **Product codebases third**, load-bearing modules first within each.
4. **Prototypes and experiments never**, beyond inheriting the portfolio's shared gates.
````

- [x] **Step 3: Create `content/eidos/03-form-template.md`**

Note the nested fences: this document contains fenced blocks of its own, which must survive intact.

````markdown
---
title: "Form Template & Gate Registry"
order: 3
version: "0.2"
summary: "The canonical templates for a Form document and the gate registry, plus the parity check that makes the registry impossible to quietly falsify."
---

A Form document is written for two readers: the agent that consumes it at task start, and the parity check that verifies it at CI time. Keep it short enough that an agent reads all of it, and structured enough that a script can parse the gates table.

## Form document template

Save as `forms/<module-name>.md` in the repository.

```markdown
# Form: <module-name>

status: active | deprecated
owner: <human — Forms are never agent-owned>
level: E1 | E2 | E3          # highest drill this module has passed
last-drill: <date or never>   # last regenerability drill

## Purpose
One paragraph: what this module is for and what would break without it.

## Interface
The complete public surface. Signatures, types, events, error contract.
Anything not listed here is hidden implementation and may be regenerated
at will.

## Invariants
Numbered, testable statements that must hold across ALL implementations:
  I1. <e.g. "No state transition skips the PENDING_REVIEW state.">
  I2. <e.g. "All amounts are integer minor units; floats never cross this boundary.">

## Hidden decisions
Decisions deliberately concealed behind the interface (per Parnas), so an
agent does not "helpfully" surface them:
  - <e.g. "Storage engine choice. Callers must not know or care.">

## Gates
Fitness functions guarding this Form:
| ID | Guards | Mechanism | Location | Blocks |
|----|--------|-----------|----------|--------|
| G1 | I1 | <lint rule / dep-graph assertion / type constraint / CI script / hook> | <path or CI job name> | build / merge / commit |
| G2 | I2 | ... | ... | ... |

Every invariant MUST appear in the Guards column of at least one gate,
or have an entry under Unenforced.

## Unenforced (should be empty)
Invariants with no fitness function, each with a reason and a date.
These are debts.

## Regeneration notes
What an agent needs to rebuild the implementation from scratch: test
entry points, fixtures, environment assumptions, forbidden dependencies.
```

## Gate registry template

Save as `forms/registry.md`. One row per fitness function across the whole repo. This is the file the parity check reads.

```markdown
# Gate Registry

| ID | Form | Mechanism | Location | Verified-by |
|----|------|-----------|----------|-------------|
| payments.G1 | forms/payments.md | import-linter contract | .importlinter §payments | ci/parity |
| payments.G2 | forms/payments.md | mypy strict on module | pyproject.toml | ci/parity |
| atlas.G1 | forms/atlas.md | staleness audit | scripts/audit_staleness.py | ci/parity |
```

**Parity check (mandatory gate zero):** a CI script that fails when
(a) a registry row's mechanism does not exist or does not run in CI,
(b) a Form document declares a gate absent from the registry, or
(c) an invariant has neither a gate nor an Unenforced entry.
The registry lying is the one failure mode Eidos cannot tolerate.

## Writing guidance

- **Interfaces earn their width.** Every exported symbol is surface an agent must respect and a human must maintain. Prefer one deep entry point over five shallow ones.
- **Invariants are sentences a test can falsify.** "The module is well-designed" is not an invariant. "No public function performs I/O" is.
- **Hidden decisions are the soul of the Form.** If the section is empty, the module is probably shallow — reconsider whether it deserves a Form at all.
- **The Blocks column is never empty.** A gate that blocks nothing is prose.
````

- [x] **Step 4: Create `content/eidos/04-infrastructure.md`**

````markdown
---
title: "Eidos for Infrastructure"
order: 4
version: "0.2"
summary: "Where declarative tooling already separates Form from implementation, drift is the enemy, and six fitness functions buy an E2 estate in a weekend."
---

## Why infrastructure is Eidos's home turf

Infrastructure has the best natural fitness-function story of any domain: declarative tools already separate Form from implementation. A Terraform config, a Docker Compose file, an Ansible playbook, a NixOS config — each *is* a Form, and `plan`/`diff`/`validate` *is* a fitness function. The philosophy doesn't need to be imported into infra; it needs to be made explicit and completed, because infra also has the worst failure mode: **drift** — reality silently diverging from the declared Form until the declaration is fiction.

The Eidos statement for infrastructure: **the declared state is the Form; the running system is the implementation; drift detection is the fitness function; and an agent may reshape the running system freely so long as the Form is satisfied.**

## The three commitments, translated

### Maximal Convention
- Prefer the tool the corpus knows: Docker Compose over bespoke shell orchestration, Terraform/OpenTofu over hand-rolled provisioning scripts, standard Tailscale ACL syntax over custom VPN glue. An agent has seen a million Compose files; it has seen zero copies of your custom `deploy.sh`.
- One repo (or one clearly-bounded directory) that declares everything. Scattered per-machine configs are prose-in-heads with extra steps.

### Mechanical Enforcement
- **Validation gates (pre-apply):** `terraform validate` + policy-as-code (OPA/Conftest, Sentinel), `docker compose config`, lint on every declarative file. These run in CI and in hooks, and they block.
- **Drift gates (post-apply, the important ones):** scheduled `terraform plan -detailed-exitcode`, container state vs. compose file comparison, config-file checksums on hosts. Drift detection that only reports is a warning; the Eidos-conformant version *fails a scheduled CI job* and creates work that cannot be ignored.
- **Invariant gates:** scripted assertions of the invariants that matter — "only ports X,Y exposed beyond the tailnet," "every service has a healthcheck," "backups restored successfully within N days." Each is a cron-driven check that goes red, not a wiki page.

### Human-Designed Seams
The Forms worth authoring for a small infra estate are few:

1. **Network Form** — the topology: what is on the tailnet, what is exposed, ACLs as the interface. Invariants like "no service reachable from WAN except through the reverse proxy." Gate: an external port-scan assertion plus ACL file linting.
2. **Service Form (one per service class, not per service)** — what every deployed service must provide: healthcheck, resource limits, restart policy, log destination, backup annotation. Gate: a Compose/K8s manifest linter that rejects nonconforming services.
3. **Data Form** — what is stateful, where it lives, how it's backed up, restore SLO. Gate: automated restore drills on a schedule; a backup that has never been restored is Unenforced debt.
4. **Secrets Form** — where secrets live and the invariant that they appear nowhere else. Gate: secret-scanning in CI and on the hosts.

Everything else — which container image, which internal wiring, how a service is implemented — is implementation. Delete and regenerate freely.

## The regenerability drill, infra edition

The E3 acid test translates directly and is *more* achievable in infra than in application code: **can an agent rebuild a machine from the repo alone?** Pick one host, wipe it (or provision a fresh VM), hand the agent the Forms, and see if the estate converges with all gates green. Every manual step you perform during recovery is an undocumented Form — write it down or automate it, then re-run.

For a multi-machine tailnet lab, the drill order is: least-critical node first, then one node per month. A home lab that survives node-wipe drills is, structurally, better run than most production estates.

## Starter gate set (first week)

| Gate | Mechanism | Blocks |
|---|---|---|
| Declarative files valid | terraform validate / compose config / yamllint in CI + pre-commit hook | commit, merge |
| No secrets in repo | gitleaks or trufflehog in CI + hook | commit, merge |
| No drift | scheduled plan/diff job, non-zero exit on drift | scheduled job goes red |
| Exposure invariant | external scan asserting only declared ports respond | scheduled job goes red |
| Service conformance | manifest linter enforcing the Service Form | merge |
| Restores work | scheduled restore drill of one datastore | scheduled job goes red |

Six fitness functions, all deterministic, all blocking. That is E2 for an infrastructure estate, and it is roughly one weekend of work.
````

- [x] **Step 5: Verify no mojibake survived**

Run: `grep -rn 'â\|Â' content/eidos/`
Expected: no output.

- [x] **Step 6: Commit**

```bash
git add content/eidos/
git commit -m "content: add Eidos specification documents"
```

---

### Task 8: Load the Eidos collection

**Files:**
- Modify: `src/lib/frontmatter.ts`
- Modify: `src/lib/content.ts`

**Interfaces:**
- Consumes: `loadAll`, `slugFromOrderedPath` from Task 1; the files from Task 7.
- Produces: `EidosFrontmatter` in `src/lib/frontmatter.ts`, re-exported from `content.ts`; `loadEidosDocs(): Promise<ContentEntry<EidosFrontmatter>[]>` sorted ascending by `order`.

Only the list loader is written. Task 9's document page finds its document inside the loaded list — it needs every title anyway for the sidebar and prev/next — so a single-document lookup would be an export with no caller.

- [x] **Step 1: Add the frontmatter type to `src/lib/frontmatter.ts`**

```ts
export interface EidosFrontmatter {
  title: string;
  order: number;
  version: string;
  summary: string;
}
```

- [x] **Step 2: Wire it through `src/lib/content.ts`**

Add `slugFromOrderedPath` to the `./markdown` import, add `EidosFrontmatter` to both the `import type` and the `export type` lines for `./frontmatter`, then add the glob beside the other two:

```ts
const eidosModules = import.meta.glob<string>('/content/eidos/*.md', {
  query: '?raw',
  import: 'default',
});
```

- [x] **Step 3: Add the loader at the end of the file**

```ts
export async function loadEidosDocs(): Promise<ContentEntry<EidosFrontmatter>[]> {
  const entries = await loadAll<EidosFrontmatter>(eidosModules, slugFromOrderedPath);
  return entries.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}
```

- [x] **Step 4: Verify**

Run: `npm run build && npm run lint`
Expected: both pass.

- [x] **Step 5: Commit**

```bash
git add src/lib/frontmatter.ts src/lib/content.ts
git commit -m "feat: load the Eidos specification collection"
```

---

### Task 9: The Eidos section

**Files:**
- Create: `src/pages/Eidos.tsx`
- Create: `src/pages/EidosDoc.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/NavBar.tsx:3-7`

**Interfaces:**
- Consumes: `loadEidosDocs`, `EidosFrontmatter`, `ContentEntry` from Task 8; the `.prose` class from Task 3.
- Produces: routes `/eidos` and `/eidos/:slug`. The essay's closing link resolves once this lands.

Both pages load the whole collection rather than a single document: the sidebar and the prev/next links need every title anyway, and four small files make a second lookup pointless.

- [x] **Step 1: Create `src/pages/Eidos.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadEidosDocs, type ContentEntry, type EidosFrontmatter } from '../lib/content';

export default function Eidos() {
  const [docs, setDocs] = useState<ContentEntry<EidosFrontmatter>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEidosDocs().then(d => { setDocs(d); setLoading(false); });
  }, []);

  const version = docs[0]?.frontmatter.version;

  return (
    <div style={{ padding: '6rem 2rem 2rem', maxWidth: '48rem', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Eidos</h1>
        {version && (
          <span style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-accent)',
            background: 'var(--color-accent-dim)',
            padding: '0.15rem 0.5rem',
            borderRadius: '3px',
          }}>
            v{version}
          </span>
        )}
      </div>

      <p style={{ color: 'var(--color-text-muted)', margin: '1rem 0 2.5rem', lineHeight: 1.7 }}>
        An architecture for cheap code: humans design the Forms, agents fill them, and
        fitness functions verify the fit. The argument is in{' '}
        <Link to="/blog/eidos-an-architecture-for-cheap-code">the essay</Link>; the
        specification is below.
      </p>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {docs.map((doc, i) => (
            <Link
              key={doc.slug}
              to={`/eidos/${doc.slug}`}
              style={{
                display: 'block',
                padding: '1.5rem',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-gear-stroke)',
                borderRadius: '8px',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-surface-hover)';
                e.currentTarget.style.borderColor = 'var(--color-accent-dim)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--color-surface)';
                e.currentTarget.style.borderColor = 'var(--color-gear-stroke)';
              }}
            >
              <span style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-muted)',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.3rem 0', color: 'var(--color-text)' }}>
                {doc.frontmatter.title}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {doc.frontmatter.summary}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 2: Create `src/pages/EidosDoc.tsx`**

The two columns use `flexWrap` with a wide `flex-basis` on the article rather than a media query, so the sidebar stacks above the text on narrow screens without adding CSS.

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loadEidosDocs, type ContentEntry, type EidosFrontmatter } from '../lib/content';

export default function EidosDoc() {
  const { slug } = useParams<{ slug: string }>();
  const [docs, setDocs] = useState<ContentEntry<EidosFrontmatter>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEidosDocs().then(d => { setDocs(d); setLoading(false); });
  }, []);

  const index = docs.findIndex(d => d.slug === slug);
  const doc = index >= 0 ? docs[index] : null;
  const prev = index > 0 ? docs[index - 1] : null;
  const next = index >= 0 && index < docs.length - 1 ? docs[index + 1] : null;

  if (loading) {
    return (
      <div style={{ padding: '6rem 2rem 2rem', maxWidth: '60rem', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ padding: '6rem 2rem 2rem', maxWidth: '60rem', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Document not found.</p>
        <Link to="/eidos" style={{ marginTop: '1rem', display: 'inline-block' }}>Back to Eidos</Link>
      </div>
    );
  }

  return (
    <div style={{
      padding: '6rem 2rem 2rem',
      maxWidth: '60rem',
      margin: '0 auto',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '3rem',
      alignItems: 'flex-start',
    }}>
      <nav style={{ flex: '1 1 11rem', minWidth: '11rem', position: 'sticky', top: '6rem' }}>
        <Link to="/eidos" style={{
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}>
          Eidos v{doc.frontmatter.version}
        </Link>
        <ol style={{ listStyle: 'none', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {docs.map(d => (
            <li key={d.slug}>
              <Link
                to={`/eidos/${d.slug}`}
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  color: d.slug === doc.slug ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}
              >
                {d.frontmatter.title}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div style={{ flex: '1 1 30rem', minWidth: 0 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
          {doc.frontmatter.title}
        </h1>
        <article className="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          marginTop: '4rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--color-gear-stroke)',
          fontSize: '0.85rem',
        }}>
          <span>{prev && <Link to={`/eidos/${prev.slug}`}>&larr; {prev.frontmatter.title}</Link>}</span>
          <span>{next && <Link to={`/eidos/${next.slug}`}>{next.frontmatter.title} &rarr;</Link>}</span>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Register the routes in `src/App.tsx`**

Add the two imports beside the others, and the two route entries after the projects routes:

```tsx
import Eidos from './pages/Eidos';
import EidosDoc from './pages/EidosDoc';
```

```tsx
      { path: 'eidos', element: <Eidos /> },
      { path: 'eidos/:slug', element: <EidosDoc /> },
```

- [x] **Step 4: Add the nav entry in `src/components/NavBar.tsx`**

```tsx
const links = [
  { to: '/blog', label: 'Writing' },
  { to: '/eidos', label: 'Eidos' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];
```

And the same entry in `src/pages/Landing.tsx`, which keeps its own copy:

```tsx
const navItems = [
  { to: '/blog', label: 'Writing' },
  { to: '/eidos', label: 'Eidos' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];
```

- [x] **Step 5: Verify**

Run: `npm run build && npm run lint`, then `npm run dev`.
Expected:
- `/eidos` lists four documents in order with a `v0.2` badge and summaries.
- `/eidos/architecture` renders with the sidebar, and its Vocabulary and Conformance tables have visible borders and scroll horizontally on a narrow window rather than stretching the page.
- `/eidos/form-template` renders its nested fenced blocks as highlighted code, not as parsed markdown.
- Prev/next work at both ends: `architecture` has no previous, `infrastructure` has no next.
- The in-document links work: Commitment 2 in `architecture` reaches `/eidos/form-template`, and Sequencing in `adoption` reaches `/eidos/infrastructure`.
- The essay's closing "continue here" link now resolves.
- Narrowing the browser to phone width stacks the sidebar above the document.

- [x] **Step 6: Commit**

```bash
git add src/pages/Eidos.tsx src/pages/EidosDoc.tsx src/App.tsx src/components/NavBar.tsx src/pages/Landing.tsx
git commit -m "feat: add the Eidos specification section"
```

---

### Task 10: Site constants and per-page head tags

React 19 hoists `<title>` and `<meta>` elements rendered anywhere in the tree into `<head>`, so client-side navigation can update them with no helmet library and no new dependency. Task 11 handles the crawler's view; this task handles the browser's.

**Files:**
- Create: `src/lib/site.ts`
- Modify: `src/pages/Landing.tsx`, `src/pages/Blog.tsx`, `src/pages/BlogPost.tsx`, `src/pages/Projects.tsx`, `src/pages/ProjectDetail.tsx`, `src/pages/About.tsx`, `src/pages/Eidos.tsx`, `src/pages/EidosDoc.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `SITE` — `{ origin, title, author, description, image?: string }` — imported by every page and, in Task 11, by the Node build script. It must contain no `import.meta` and no JSX.

- [x] **Step 1: Create `src/lib/site.ts`**

`public/images/` currently holds only an empty `projects/` directory, so there is no social image to point at. `image` is therefore optional and unset; adding one later means dropping a file in `public/` and setting one field.

```ts
/** Shared by the app and by scripts/prerender.ts. Keep free of import.meta. */
export const SITE = {
  origin: 'https://adbarc92.github.io',
  title: 'Alex Barclay',
  author: 'Alex Barclay',
  description:
    'Software engineering, machine learning, and robotics — essays, projects, and the Eidos architecture.',
  /** Absolute path under public/, e.g. '/images/og.png'. Unset until one exists. */
  image: undefined as string | undefined,
};

export function pageTitle(page?: string): string {
  return page ? `${page} — ${SITE.title}` : SITE.title;
}
```

- [x] **Step 2: Add head tags to the two dynamic pages**

In `src/pages/BlogPost.tsx`, inside the successful-render return, as the first children of the wrapping `<div>`:

```tsx
      <title>{pageTitle(post.frontmatter.title)}</title>
      <meta name="description" content={post.frontmatter.excerpt} />
```

In `src/pages/EidosDoc.tsx`, likewise:

```tsx
      <title>{pageTitle(doc.frontmatter.title)}</title>
      <meta name="description" content={doc.frontmatter.summary} />
```

Both files need `import { pageTitle } from '../lib/site';`.

- [x] **Step 3: Add head tags to the six static pages**

Same pattern, with literal strings. Add `import { pageTitle, SITE } from '../lib/site';` where `SITE` is used.

| File | Tags to add as the first children of the outermost element |
|---|---|
| `src/pages/Landing.tsx` | `<title>{pageTitle()}</title>` and `<meta name="description" content={SITE.description} />` |
| `src/pages/Blog.tsx` | `<title>{pageTitle('Writing')}</title>` and `<meta name="description" content="Essays on software, fiction, and whatever else holds still long enough." />` |
| `src/pages/Projects.tsx` | `<title>{pageTitle('Projects')}</title>` and `<meta name="description" content="Selected work across software engineering, machine learning, and robotics." />` |
| `src/pages/ProjectDetail.tsx` | `<title>{pageTitle(project.frontmatter.title)}</title>` and `<meta name="description" content={project.frontmatter.description} />`, inside the successful-render return |
| `src/pages/About.tsx` | `<title>{pageTitle('About')}</title>` and `<meta name="description" content={SITE.description} />` |
| `src/pages/Eidos.tsx` | `<title>{pageTitle('Eidos')}</title>` and `<meta name="description" content="An architecture for cheap code: humans design the Forms, agents fill them, fitness functions verify the fit." />` |

- [x] **Step 4: Verify**

Run: `npm run build && npm run lint`, then `npm run dev`.
Expected: the browser tab reads "Eidos: An Architecture for Cheap Code — Alex Barclay" on the essay, and changes as you navigate between the essay, `/eidos/adoption`, and `/projects` without a reload. Inspect `<head>` in devtools and confirm exactly one `<title>` and one `<meta name="description">` — a duplicate means a page rendered its tags in two branches.

- [x] **Step 5: Commit**

```bash
git add src/lib/site.ts src/pages
git commit -m "feat: add site constants and per-page head tags"
```

---

### Task 11: Prerender static HTML

Today a crawler requesting any URL gets `<div id="root"></div>` and the title "Alex Barclay". This task makes every route serve real HTML with real metadata.

**Files:**
- Create: `scripts/prerender.ts`
- Modify: `package.json`
- Modify: `tsconfig.node.json`

**Interfaces:**
- Consumes: `parseMarkdown`, `slugFromDatedPath`, `slugFromOrderedPath` from Task 1; the frontmatter types from `src/lib/frontmatter.ts` (Tasks 1, 2, 8) via a type-only import, which is erased at runtime so the Vite-only `content.ts` is never pulled into Node; `SITE`, `pageTitle` from Task 10.
- Produces: `dist/<route>/index.html` for every route, and `dist/404.html`. Task 12 extends the same script.

Deliberately **not** using `hydrateRoot`: `main.tsx` calls `createRoot().render()`, which discards whatever sits inside `#root`. The injected HTML exists for clients that never run JavaScript; the browser throws it away and renders the real app microseconds later. Because the script never executes React, the Three.js gear background never runs under Node — which is what keeps this approach cheap.

- [x] **Step 1: Add the one authorised devDependency**

Run: `npm install --save-dev tsx`

Node 22 can strip types natively, but CI pins Node 20 and the flag is experimental there.

- [x] **Step 2: Include the script in the Node tsconfig**

Open `tsconfig.node.json` and add `"scripts"` to its `include` array so `tsc -b` type-checks the script rather than ignoring it. If the array reads `["vite.config.ts"]`, it becomes:

```json
"include": ["vite.config.ts", "scripts"]
```

- [x] **Step 3: Create `scripts/prerender.ts`**

```ts
/**
 * Post-build static HTML generation.
 *
 * The site is a client-rendered SPA, so without this every route serves an
 * empty shell to crawlers and unfurlers. This walks the same content the app
 * globs, and writes a real HTML file per route with correct metadata and the
 * article text already in the body.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  parseMarkdown,
  slugFromDatedPath,
  slugFromOrderedPath,
} from '../src/lib/markdown';
import type {
  BlogFrontmatter,
  ProjectFrontmatter,
  EidosFrontmatter,
} from '../src/lib/frontmatter';
import { SITE, pageTitle } from '../src/lib/site';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const CONTENT = join(ROOT, 'content');

interface Page {
  /** Route path with a leading slash, '/' for the landing page. */
  route: string;
  title: string;
  description: string;
  /** Rendered article HTML, injected for non-JS clients. Empty for index pages. */
  body: string;
  /** 'article' for posts and documents, 'website' otherwise. */
  type: 'article' | 'website';
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readCollection<T>(dir: string, slugFn: (path: string) => string) {
  const full = join(CONTENT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const raw = readFileSync(join(full, file), 'utf8');
      const { frontmatter, html } = parseMarkdown<T>(raw);
      return { slug: slugFn(file), frontmatter, html };
    });
}

const posts = readCollection<BlogFrontmatter>('blog', slugFromDatedPath)
  .filter(p => !p.frontmatter.draft)
  .sort(
    (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
  );

const projects = readCollection<ProjectFrontmatter>('projects', slugFromDatedPath).sort(
  (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
);

const eidosDocs = readCollection<EidosFrontmatter>('eidos', slugFromOrderedPath).sort(
  (a, b) => a.frontmatter.order - b.frontmatter.order
);

const pages: Page[] = [
  { route: '/', title: pageTitle(), description: SITE.description, body: '', type: 'website' },
  {
    route: '/blog',
    title: pageTitle('Writing'),
    description: 'Essays on software, fiction, and whatever else holds still long enough.',
    body: '',
    type: 'website',
  },
  {
    route: '/projects',
    title: pageTitle('Projects'),
    description: 'Selected work across software engineering, machine learning, and robotics.',
    body: '',
    type: 'website',
  },
  {
    route: '/about',
    title: pageTitle('About'),
    description: SITE.description,
    body: '',
    type: 'website',
  },
  {
    route: '/eidos',
    title: pageTitle('Eidos'),
    description:
      'An architecture for cheap code: humans design the Forms, agents fill them, fitness functions verify the fit.',
    body: '',
    type: 'website',
  },
  ...posts.map((p): Page => ({
    route: `/blog/${p.slug}`,
    title: pageTitle(p.frontmatter.title),
    description: p.frontmatter.excerpt,
    body: p.html,
    type: 'article',
  })),
  ...projects.map((p): Page => ({
    route: `/projects/${p.slug}`,
    title: pageTitle(p.frontmatter.title),
    description: p.frontmatter.description,
    body: p.html,
    type: 'article',
  })),
  ...eidosDocs.map((d): Page => ({
    route: `/eidos/${d.slug}`,
    title: pageTitle(d.frontmatter.title),
    description: d.frontmatter.summary,
    body: d.html,
    type: 'article',
  })),
];

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');

function render(page: Page): string {
  const url = `${SITE.origin}${page.route}`;
  const tags = [
    `<title>${escapeAttr(page.title)}</title>`,
    `<meta name="description" content="${escapeAttr(page.description)}" />`,
    `<meta name="author" content="${escapeAttr(SITE.author)}" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:type" content="${page.type}" />`,
    `<meta property="og:site_name" content="${escapeAttr(SITE.title)}" />`,
    `<meta property="og:title" content="${escapeAttr(page.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(page.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    SITE.image ? `<meta property="og:image" content="${escapeAttr(SITE.origin + SITE.image)}" />` : '',
    `<meta name="twitter:card" content="${SITE.image ? 'summary_large_image' : 'summary'}" />`,
    `<link rel="alternate" type="application/rss+xml" title="${escapeAttr(SITE.title)}" href="${SITE.origin}/rss.xml" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  return shell
    .replace(/<title>[\s\S]*?<\/title>/, tags)
    .replace(
      '<div id="root"></div>',
      `<div id="root">${page.body}</div>`
    );
}

let count = 0;
for (const page of pages) {
  const dir = page.route === '/' ? DIST : join(DIST, page.route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), render(page), 'utf8');
  count++;
}

// The SPA fallback keeps the bare shell: it stands in for unknown URLs and must
// not claim another page's canonical or description.
writeFileSync(join(DIST, '404.html'), shell, 'utf8');

console.log(`prerender: wrote ${count} pages + 404.html`);
```

The `<title>` replacement is what anchors the injected tags — the built shell always contains exactly one `<title>Alex Barclay</title>`, which becomes the whole metadata block.

- [x] **Step 4: Wire it into the build**

In `package.json`:

```json
    "build": "tsc -b && vite build && tsx scripts/prerender.ts",
```

There is now no way to produce a deployable build without metadata.

- [x] **Step 5: Verify the output, not the browser**

Run: `npm run build`
Expected: the final line reads `prerender: wrote 12 pages + 404.html` (5 static + 2 posts + 1 project + 4 Eidos documents; the draft probe is excluded).

```bash
grep -c '<title>' dist/blog/eidos-an-architecture-for-cheap-code/index.html   # 1
grep -o '<title>[^<]*' dist/blog/eidos-an-architecture-for-cheap-code/index.html
grep -o 'og:description" content="[^"]\{0,60\}' dist/blog/eidos-an-architecture-for-cheap-code/index.html
grep -c 'For roughly fifty years' dist/blog/eidos-an-architecture-for-cheap-code/index.html   # 1
ls dist/blog/                     # the draft probe must NOT be here
grep -o '<title>[^<]*' dist/404.html   # bare "Alex Barclay"
```

Then run `npm run preview` and confirm the site still behaves — navigation, filtering, the Eidos sidebar — because the injected HTML is replaced on mount and must leave no trace.

- [x] **Step 6: Commit**

```bash
git add scripts/prerender.ts package.json package-lock.json tsconfig.node.json
git commit -m "feat: prerender static HTML with per-page metadata"
```

---

### Task 12: RSS and sitemap

**Files:**
- Modify: `scripts/prerender.ts`

**Interfaces:**
- Consumes: `posts` and `pages` from Task 11.
- Produces: `dist/rss.xml`, `dist/sitemap.xml`.

- [x] **Step 1: Append the feed generation to `scripts/prerender.ts`**

Place this after the 404 write and before the `console.log`, then update the log line.

```ts
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const rssItems = posts
  .map(p => {
    const url = `${SITE.origin}/blog/${p.slug}`;
    return `    <item>
      <title>${escapeXml(p.frontmatter.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(p.frontmatter.date).toUTCString()}</pubDate>
      <description>${escapeXml(p.frontmatter.excerpt)}</description>
    </item>`;
  })
  .join('\n');

writeFileSync(
  join(DIST, 'rss.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.title)}</title>
    <link>${SITE.origin}/blog</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>en</language>
    <atom:link href="${SITE.origin}/rss.xml" rel="self" type="application/rss+xml" />
${rssItems}
  </channel>
</rss>
`,
  'utf8'
);

writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${escapeXml(SITE.origin + p.route)}</loc></url>`).join('\n')}
</urlset>
`,
  'utf8'
);
```

Update the final line to:

```ts
console.log(`prerender: wrote ${count} pages + 404.html, rss.xml, sitemap.xml`);
```

- [x] **Step 2: Verify**

Run: `npm run build`

```bash
grep -c '<item>' dist/rss.xml        # 2
grep -c '<loc>' dist/sitemap.xml     # 12
grep -c 'draft-probe' dist/rss.xml dist/sitemap.xml   # 0 in both
```

Expected: `items: 2` (the essay and Hello World, not the draft probe), 12 `<loc>` entries, and zero `draft-probe` matches in either file. Open `dist/rss.xml` in a browser to confirm it parses as XML rather than showing a parse error.

- [x] **Step 3: Commit**

```bash
git add scripts/prerender.ts
git commit -m "feat: emit RSS feed and sitemap at build time"
```

---

### Task 13: Deploy wiring and final verification

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Delete: `content/blog/2026-08-10-draft-probe.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing further.

- [x] **Step 1: Drop the workflow's 404 step**

`scripts/prerender.ts` now writes `dist/404.html`, and leaving the workflow step in would overwrite it with a copy of the prerendered landing page — carrying the landing page's canonical URL onto every unknown URL. Remove these two lines from `.github/workflows/deploy.yml`:

```yaml
      - name: Copy index.html to 404.html for SPA routing
        run: cp dist/index.html dist/404.html
```

The `npm run build` step above it now produces `404.html` itself, so `npm run preview` finally behaves like production.

- [x] **Step 2: Remove the draft probe**

```bash
rm content/blog/2026-08-10-draft-probe.md
```

- [x] **Step 3: Full verification pass**

Run: `npm run build && npm run lint && npm run preview`

Confirm, against the built site:
- `/blog` shows two posts, the essay first, with `Software (1)` and `Meta (1)` chips.
- No DRAFT badge appears anywhere, and `dist/blog/` contains exactly `eidos-an-architecture-for-cheap-code/` and `hello-world/`.
- `/eidos` lists four documents; each renders with working sidebar, tables, prev/next, and cross-document links.
- The essay's closing link reaches `/eidos`.
- Every generated `index.html` has a distinct `<title>`; none is the bare "Alex Barclay" except `404.html`:
  ```bash
  grep -h -o '<title>[^<]*' dist/index.html dist/blog/*/index.html dist/eidos/*/index.html | sort | uniq -c
  ```
- An unknown deep URL under `npm run preview` still boots the SPA.

- [x] **Step 4: Commit and open the pull request**

```bash
git add .github/workflows/deploy.yml
git rm content/blog/2026-08-10-draft-probe.md
git commit -m "chore: move 404 generation into prerender and drop the draft probe"
git push -u origin feat/essays-and-taxonomy
gh pr create --title "Publish the Eidos essay and specification, with taxonomy and crawlability" --body "..."
```

Per the repo's conventions, do not push directly to `main` and do not add attribution footers to the commit or the PR body.

---

### Task 14: Test suite for the pure logic

Added after the final review. The plan deliberately shipped without a test runner, and the final whole-branch review named coverage as the branch's largest carried risk; a repository policy gate then blocked the pull request for the same reason. Both point the same way, and the branch has meanwhile created several genuinely testable pure modules that did not exist before it.

This task is not gate appeasement. Every test below covers logic that has already produced a real bug in this branch, or guards a boundary the reviewers flagged.

**Files:**
- Create: `src/lib/escape.ts` (moved out of `scripts/prerender.ts`)
- Create: `src/lib/dates.test.ts`, `src/lib/markdown.test.ts`, `src/lib/escape.test.ts`, `src/lib/frontmatter.test.ts`
- Modify: `src/lib/frontmatter.ts` (add `isPublished`)
- Modify: `src/lib/content.ts` (use `isPublished`)
- Modify: `scripts/prerender.ts` (import the escape helpers and `isPublished` instead of defining its own)
- Modify: `package.json`, `vite.config.ts`

**Interfaces:**
- Produces: `escapeAttr(value: string): string` and `escapeXml(value: string): string` from `src/lib/escape.ts`; `isPublished(frontmatter: { draft?: boolean }, showDrafts: boolean): boolean` from `src/lib/frontmatter.ts`; `npm test`.

Two small refactors come first, because they are what makes the logic reachable from a test at all:

- **`escapeAttr` / `escapeXml` are currently module-private inside `scripts/prerender.ts`,** which executes its whole pipeline at import time. Importing that file from a test would run a build. Move both functions to `src/lib/escape.ts` — pure, no side effects, no `import.meta` — and import them in the script.
- **The draft rule is written out four times** (the post list, the single-post lookup, and the prerender script's page and feed filters). The final review confirmed all four agree today; nothing keeps them agreeing. Collapse them onto one predicate.

- [x] **Step 1: Install Vitest**

Run: `npm install --save-dev vitest`

This is the second and last new devDependency in the plan, and it is authorised by the decision to add this task.

- [x] **Step 2: Create `src/lib/escape.ts` and use it in the script**

Move both functions verbatim out of `scripts/prerender.ts`:

```ts
/**
 * Escaping for generated HTML attributes and XML text. Pure — imported by both
 * the app-side modules and scripts/prerender.ts, so no import.meta, no side effects.
 *
 * Ampersand is replaced first in both, otherwise the ampersands introduced by the
 * later replacements would themselves be escaped.
 */

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

Delete both definitions from `scripts/prerender.ts` and add `import { escapeAttr, escapeXml } from '../src/lib/escape';`.

- [x] **Step 3: Add `isPublished` to `src/lib/frontmatter.ts`**

```ts
/**
 * The single draft rule. A post is published unless it is flagged a draft, and
 * drafts are shown only where the caller says so — the dev server, never a build.
 * Kept here so the four filter points cannot drift apart.
 */
export function isPublished(frontmatter: { draft?: boolean }, showDrafts: boolean): boolean {
  return showDrafts || !frontmatter.draft;
}
```

Then use it at all four sites. In `src/lib/content.ts`:

```ts
  return entries.filter(e => isPublished(e.frontmatter, SHOW_DRAFTS)).sort(byDateDesc);
```

```ts
  if (!isPublished(entry.frontmatter, SHOW_DRAFTS)) return null;
```

In `scripts/prerender.ts`, the build never shows drafts, so pass `false`:

```ts
  .filter(p => isPublished(p.frontmatter, false))
```

- [x] **Step 4: Configure Vitest in `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

And in `package.json`, add to `scripts`:

```json
    "test": "vitest run",
```

- [x] **Step 5: Write `src/lib/dates.test.ts`**

This is the regression that shipped one day early on every date on the site.

```ts
import { describe, it, expect } from 'vitest';
import { formatDate } from './dates';

describe('formatDate', () => {
  it('renders the authored calendar day rather than the local-time one', () => {
    // Regression guard: new Date('2026-08-10') is UTC midnight, so formatting in
    // local time renders "August 9" anywhere west of Greenwich.
    expect(formatDate('2026-08-10')).toBe('August 10, 2026');
    expect(formatDate('2026-02-27')).toBe('February 27, 2026');
  });

  it('accepts a Date, because the YAML parser resolves an unquoted date to one', () => {
    expect(formatDate(new Date('2026-08-10T00:00:00Z'))).toBe('August 10, 2026');
  });

  it('does not slip across a year boundary', () => {
    expect(formatDate('2026-01-01')).toBe('January 1, 2026');
    expect(formatDate('2026-12-31')).toBe('December 31, 2026');
  });
});
```

- [x] **Step 6: Write `src/lib/markdown.test.ts`**

The GFM and highlighting cases guard the `marked.use(...)` configuration that `About.tsx` was silently depending on before the final fix wave.

```ts
import { describe, it, expect } from 'vitest';
import { parseMarkdown, slugFromDatedPath, slugFromOrderedPath } from './markdown';

describe('slugFromDatedPath', () => {
  it('strips the date prefix and the extension', () => {
    expect(slugFromDatedPath('/content/blog/2026-08-10-eidos-an-architecture.md'))
      .toBe('eidos-an-architecture');
  });

  it('leaves an undated filename alone', () => {
    expect(slugFromDatedPath('/content/blog/hello.md')).toBe('hello');
  });

  it('strips only the leading date, not digits inside the title', () => {
    expect(slugFromDatedPath('/content/blog/2026-08-10-2026-in-review.md'))
      .toBe('2026-in-review');
  });
});

describe('slugFromOrderedPath', () => {
  it('strips the ordering prefix', () => {
    expect(slugFromOrderedPath('/content/eidos/01-architecture.md')).toBe('architecture');
    expect(slugFromOrderedPath('/content/eidos/04-infrastructure.md')).toBe('infrastructure');
  });
});

describe('parseMarkdown', () => {
  it('separates frontmatter from body', () => {
    const { frontmatter, html } = parseMarkdown<{ title: string; tags: string[] }>(
      '---\ntitle: "T"\ntags: ["a", "b"]\n---\n\nBody text.\n'
    );
    expect(frontmatter.title).toBe('T');
    expect(frontmatter.tags).toEqual(['a', 'b']);
    expect(html).toContain('Body text.');
    expect(html).not.toContain('title:');
  });

  it('accepts CRLF delimiters, since content files may be checked out with them', () => {
    const { frontmatter } = parseMarkdown<{ title: string }>(
      '---\r\ntitle: "T"\r\n---\r\n\r\nBody.\r\n'
    );
    expect(frontmatter.title).toBe('T');
  });

  it('treats a file with no frontmatter as all body', () => {
    const { frontmatter, html } = parseMarkdown<Record<string, unknown>>('Just prose.\n');
    expect(frontmatter).toEqual({});
    expect(html).toContain('Just prose.');
  });

  it('renders GFM tables, which the specification documents depend on', () => {
    const { html } = parseMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  it('highlights fenced code', () => {
    const { html } = parseMarkdown('```js\nconst x = 1;\n```\n');
    expect(html).toContain('hljs');
    expect(html).toContain('language-js');
  });

  it('falls back to plaintext for an unknown language rather than throwing', () => {
    const { html } = parseMarkdown('```notalanguage\nx\n```\n');
    expect(html).toContain('language-plaintext');
  });
});
```

- [x] **Step 7: Write `src/lib/escape.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { escapeAttr, escapeXml } from './escape';

describe('escapeAttr', () => {
  it('prevents a quote in a title from breaking out of an attribute', () => {
    expect(escapeAttr('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('escapes an ampersand once, not twice', () => {
    // "Form Template & Gate Registry" is a real document title.
    expect(escapeAttr('Form Template & Gate Registry'))
      .toBe('Form Template &amp; Gate Registry');
  });

  it('escapes angle brackets so markup cannot be injected through a description', () => {
    expect(escapeAttr('<script>')).toBe('&lt;script&gt;');
  });
});

describe('escapeXml', () => {
  it('escapes apostrophes, which escapeAttr leaves alone', () => {
    expect(escapeXml("a human's attention")).toBe('a human&apos;s attention');
  });

  it('escapes an ampersand once, not twice', () => {
    expect(escapeXml('Form Template & Gate Registry'))
      .toBe('Form Template &amp; Gate Registry');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeXml('Eidos: An Architecture for Cheap Code'))
      .toBe('Eidos: An Architecture for Cheap Code');
  });
});
```

- [x] **Step 8: Write `src/lib/frontmatter.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isPublished, CATEGORIES } from './frontmatter';

describe('isPublished', () => {
  it('hides a draft when drafts are not being shown', () => {
    expect(isPublished({ draft: true }, false)).toBe(false);
  });

  it('shows a draft when they are — the dev server', () => {
    expect(isPublished({ draft: true }, true)).toBe(true);
  });

  it('treats an absent draft flag as published', () => {
    expect(isPublished({}, false)).toBe(true);
  });

  it('treats draft: false as published', () => {
    expect(isPublished({ draft: false }, false)).toBe(true);
  });
});

describe('CATEGORIES', () => {
  it('has no duplicate ids, which would split a filter in two', () => {
    const ids = CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every category a label', () => {
    expect(CATEGORIES.every(c => c.label.length > 0)).toBe(true);
  });
});
```

- [x] **Step 9: Verify**

Run: `npm test`
Expected: all suites pass.

Run: `npm run build && npm run lint`
Expected: both pass, and the build still reports `prerender: wrote 12 pages + 404.html, rss.xml, sitemap.xml`. The draft refactor must not change any count.

Then prove the tests can fail: temporarily change `timeZone: 'UTC'` to `timeZone: 'America/Chicago'` in `src/lib/dates.ts`, run `npm test`, and confirm the date suite goes red. Restore the file and confirm green. A suite that cannot fail is not a suite.

- [x] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib scripts/prerender.ts
git commit -m "test: cover date formatting, slugs, markdown config, escaping, and the draft rule"
```

---

### Task 15: Serve from a subpath as a GitHub Pages project site

Added after the branch was found to be aimed at the wrong repository. `adbarc92/adbarc92.github.io` is no longer a source repo: `portfolio-treatise` deploys build output onto its `main`, and its deploy script runs `git rm -rq .` on the target first, so anything committed there is destroyed on the next deploy. The React site's own history is preserved on that repo under the `v1` tag.

The writing site therefore moves to `adbarc92/writing` and is served at `https://adbarc92.github.io/writing/`, leaving the treatise as the front door at the domain root. The two are complements: the treatise's `claims.yaml` already declares an essays section whose entries are hidden because their `url` fields are empty, and this is what those URLs will point at.

Everything the site emits currently assumes it sits at the domain root — canonical URLs, the sitemap, the feed, the router, and the root-relative links written inside the markdown content. All of it needs a base path.

**Files:**
- Modify: `vite.config.ts`, `src/App.tsx`, `src/lib/site.ts`, `src/lib/markdown.ts`, `scripts/prerender.ts`, `README.md`
- Create: `src/lib/site.test.ts`
- Modify: `src/lib/markdown.test.ts`

**Interfaces:**
- Produces: `BASE_PATH`, `withBase(path: string): string`, and `absoluteUrl(route: string): string` from `src/lib/site.ts`.

- [x] **Step 1: Add the base-path helpers to `src/lib/site.ts`**

Append below the existing exports. The module stays pure — no `import.meta`, no side effects — because the prerender script imports it.

```ts
/**
 * The site is a GitHub Pages *project* site, served from a subpath rather than
 * the domain root: the treatise occupies the root. Vite's `base`, the router's
 * `basename`, and every absolute URL the build emits must agree on this value.
 */
export const BASE_PATH = '/writing';

/** Prefix a root-relative app path with the base path. `/` becomes `/writing/`. */
export function withBase(path: string): string {
  return path === '/' ? `${BASE_PATH}/` : `${BASE_PATH}${path}`;
}

/** The canonical absolute URL for a route, e.g. `/blog/x` -> `https://…/writing/blog/x`. */
export function absoluteUrl(route: string): string {
  return `${SITE.origin}${withBase(route)}`;
}
```

- [x] **Step 2: Set Vite's base**

In `vite.config.ts`, add `base: '/writing/',` to the config object, above `plugins`. Vite's `base` requires the trailing slash; `BASE_PATH` deliberately omits it, because it is concatenated with paths that begin with one.

- [x] **Step 3: Give the router its basename**

In `src/App.tsx`, import `BASE_PATH` from `./lib/site` and pass it as the router's basename:

```tsx
const router = createBrowserRouter([
  // …unchanged route definitions…
], { basename: BASE_PATH });
```

Every `<Link to="/blog">` in the app then resolves correctly with no further change — react-router prepends the basename itself. Do not hand-prefix any `to` prop.

- [x] **Step 4: Rewrite root-relative links inside rendered markdown**

This is the part the router cannot fix. The essay ends with a link to `/eidos`, and two specification documents cross-link to `/eidos/form-template` and `/eidos/infrastructure`. Those become plain `<a href="/eidos">` in the rendered HTML, which at the domain root now belongs to the treatise — the reader would land on the wrong site.

In `src/lib/markdown.ts`, import `withBase` from `./site` and add a `link` renderer beside the existing `code` one:

```ts
    link({ href, title, tokens }: Tokens.Link): string {
      // Root-relative hrefs in content are app paths and need the base path;
      // absolute URLs, mailto:, and #anchors are left exactly as authored.
      const resolved = href.startsWith('/') ? withBase(href) : href;
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${resolved}"${titleAttr}>${text}</a>`;
    },
```

`this.parser` is available because marked binds the renderer object as `this`; write it as a method, not an arrow function, or `this` will be undefined. Verify the exact behaviour with the tests in Step 7 rather than assuming the signature — marked's renderer API has changed across major versions, and this project is on v17.

- [x] **Step 5: Emit base-aware URLs from the prerender script**

In `scripts/prerender.ts`, import `absoluteUrl` and `BASE_PATH` alongside the existing `SITE` import, then replace every place a URL is built by hand:

- The per-page `const url = ...` becomes `const url = absoluteUrl(page.route);` — this fixes `<link rel="canonical">` and `og:url` together.
- The RSS alternate link in the head becomes `href="${SITE.origin}${BASE_PATH}/rss.xml"`.
- Each RSS item's `<link>` and `<guid>` become `absoluteUrl('/blog/' + p.slug)`.
- The RSS channel `<link>` becomes `absoluteUrl('/blog')`, and the `atom:link` self href becomes `${SITE.origin}${BASE_PATH}/rss.xml`.
- Each sitemap `<loc>` becomes `absoluteUrl(p.route)`.

The `dist/` directory layout does not change: Pages maps the repository's published output to `/writing/`, so `dist/blog/x/index.html` is served at `/writing/blog/x/`.

- [x] **Step 6: Update `README.md`**

Change the site URL to `https://adbarc92.github.io/writing` and add one line under Deployment noting that the domain root is served by a separate project (`portfolio-treatise`) and that this repository is a Pages project site. Keep the rest of the file as it is.

- [x] **Step 7: Test the two things that can silently break**

Create `src/lib/site.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BASE_PATH, withBase, absoluteUrl, pageTitle, SITE } from './site';

describe('withBase', () => {
  it('prefixes a root-relative path', () => {
    expect(withBase('/blog')).toBe('/writing/blog');
    expect(withBase('/eidos/form-template')).toBe('/writing/eidos/form-template');
  });

  it('turns the root into a trailing-slash base path, not a bare prefix', () => {
    expect(withBase('/')).toBe('/writing/');
  });

  it('never doubles the base path', () => {
    expect(withBase('/blog')).not.toContain(`${BASE_PATH}${BASE_PATH}`);
  });
});

describe('absoluteUrl', () => {
  it('builds a canonical URL under the base path', () => {
    expect(absoluteUrl('/blog/eidos-an-architecture-for-cheap-code'))
      .toBe('https://adbarc92.github.io/writing/blog/eidos-an-architecture-for-cheap-code');
  });

  it('builds the site root correctly', () => {
    expect(absoluteUrl('/')).toBe('https://adbarc92.github.io/writing/');
  });

  it('never emits a double slash after the origin', () => {
    expect(absoluteUrl('/blog').replace('https://', '')).not.toContain('//');
  });
});

describe('pageTitle', () => {
  it('returns the bare site title with no argument', () => {
    expect(pageTitle()).toBe(SITE.title);
  });

  it('suffixes the site title otherwise', () => {
    expect(pageTitle('Writing')).toBe(`Writing — ${SITE.title}`);
  });
});
```

Add to `src/lib/markdown.test.ts`:

```ts
describe('link rewriting', () => {
  it('prefixes a root-relative content link with the base path', () => {
    // The essay links to /eidos; at the domain root that is a different site.
    expect(parseMarkdown('[continue here](/eidos)').html).toContain('href="/writing/eidos"');
  });

  it('leaves an external URL untouched', () => {
    expect(parseMarkdown('[x](https://example.com/a)').html).toContain('href="https://example.com/a"');
  });

  it('leaves an anchor link untouched', () => {
    expect(parseMarkdown('[x](#thesis)').html).toContain('href="#thesis"');
  });

  it('keeps the link text', () => {
    expect(parseMarkdown('[continue here](/eidos)').html).toContain('>continue here</a>');
  });
});
```

- [x] **Step 8: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: all tests pass; the build still reports `prerender: wrote 12 pages + 404.html, rss.xml, sitemap.xml`.

Then confirm the base path reached every emitted URL:

```bash
grep -o 'rel="canonical" href="[^"]*"' dist/blog/eidos-an-architecture-for-cheap-code/index.html
grep -o 'href="/writing/eidos"' dist/blog/eidos-an-architecture-for-cheap-code/index.html
grep -c 'adbarc92.github.io/writing/' dist/sitemap.xml      # 12
grep -c 'adbarc92.github.io/writing/' dist/rss.xml          # at least 3
grep -o 'src="[^"]*index[^"]*js"' dist/index.html            # asset paths begin /writing/
grep -rn 'adbarc92.github.io/blog\|adbarc92.github.io/eidos' dist/ || echo "no root-relative leaks"
```

The last check is the important one: any URL still pointing at the domain root would send a reader to the treatise instead.

- [x] **Step 9: Commit**

```bash
git add vite.config.ts src/App.tsx src/lib scripts/prerender.ts README.md
git commit -m "feat: serve from /writing as a GitHub Pages project site"
```

---

## Self-Review

**Spec coverage.** Component 1 → Tasks 1, 2, 8. Component 2 → Tasks 2, 5. Component 3 → Tasks 5, 6. Component 4 → Tasks 7, 8, 9. Component 5 → Task 3. Component 6 → Tasks 2, 4, 7. Component 7 → Tasks 10, 11, 12, 13. No component is unimplemented.

**Two gaps found while writing, both closed:** `src/pages/Landing.tsx` keeps its own nav array, so the "Writing" relabel and the Eidos entry have to be applied twice (Tasks 6 and 9); and `public/images/` is empty, so `SITE.image` is optional and `twitter:card` degrades to `summary` (Task 10).

**Naming consistency.** `parseMarkdown`, `slugFromDatedPath`, and `slugFromOrderedPath` are defined in Task 1 and used under those names in Tasks 8 and 11. `SITE` and `pageTitle` are defined in Task 10 and used under those names in Task 11. `CATEGORIES` and `Category` are defined in Task 2 and used in Task 6. `loadAll` and `loadOne` stay module-private throughout.

**Deliberately deferred**, and not defects in this plan: `src/pages/About.tsx` reimplements frontmatter splitting and `marked.parse` inline instead of using `src/lib/markdown.ts`; the prerender script restates route shapes that `src/App.tsx` also declares. Both are recorded in the design document's Risks section.
