# Consolidation: Astro Absorbs the Writing Site — Design

**Date:** 2026-08-29
**Status:** proposed, pending implementation plan
**Repos:** `adbarc92/writing` (absorbed), `adbarc92/portfolio-treatise` (survives), `adbarc92/adbarc92.github.io` (publish target, unchanged)

---

## Goal

One repository, one toolchain, one build, one deploy, and one set of gates covering
everything published under `alexanderdbarclay.com`. Today the domain is served by two
source repositories on two stacks with two pipelines, and the halves do not know about
each other — which is how the front page came to have no path to the essays.

## Fixed decisions

These are settled; the plan does not revisit them.

1. **Astro wins.** The treatise's stack absorbs the writing site.
2. **`/writing/*` URLs are preserved exactly.** They carry the canonical tags, the Open
   Graph tags, the RSS feed, and any link already posted publicly. Breaking them to gain
   a prettier path is not a trade worth making.
3. **`adbarc92.github.io` remains the publish target.** A GitHub *user* site must be
   served from a repository of that exact name. It holds build output only.
4. **The merged repository is public.** The writing source already is, with public
   history. The treatise was private only under Hard Rule 5, whose reason lapsed when
   the embargo lifted on 2026-08-29.

## Non-goals

- **Redesign.** Output should be indistinguishable at cutover, with one deliberate
  exception noted under Risks (syntax highlighting).
- **Changing the treatise.** `index.astro`, `claims.yaml`, the plates, and the design
  system are untouched. It is the host, not the patient.
- **Building the gates that do not exist.** `AGENT-PROMPT.md` documents four CI gates;
  two are real. See below. Building the others is follow-on work, not migration work.
- **Renaming the repository.** Discussed at the end, deliberately last.

---

## Current state, verified 2026-08-29

| | `writing` | `portfolio-treatise` |
| --- | --- | --- |
| Stack | React 19, Vite 7, react-router 7 | Astro 5, `output: "static"` |
| Rendering | SPA + `scripts/prerender.ts` | native static |
| Content | `import.meta.glob` + `marked` + `highlight.js` | `claims.yaml` + `.astro` |
| Tests | Vitest, 41 tests | `node:test`, 11 tests |
| Visibility | public | private |
| Deploys | own Pages artifact → `/writing/` | replaces `adbarc92.github.io` → root |
| Bundle | ~2.0 MB (~596 KB gz), Three.js dominated | near-zero client JS |

### The gates, as built versus as documented

`AGENT-PROMPT.md` §CI gates lists four. Only two exist:

| Gate | Documented | Built |
| --- | --- | --- |
| Content gate (retracted claims, banned vocabulary) | yes | **yes** — `scripts/content-gate.mjs`, 11 tests |
| Canary selftest | yes | **yes** — `--selftest`, wired into CI |
| Claims gate over *rendered pages* | yes | **no** — `claims.ts` validates `claims.yaml` in-process only; its own comment says the CI half "arrives with the CI gates" |
| Link gate (every URL returns 2xx at build) | yes | **no** — no implementation in `scripts/` or `src/` |

This matters to the migration in one direction only: consolidation cannot *inherit*
link-checking for essay URLs, because there is nothing to inherit. It is worth recording
so the merged repo's documentation does not repeat the overstatement.

---

## Target structure

```
adbarc92/portfolio-treatise  (public)

  src/
    pages/
      index.astro                    treatise — unchanged
      writing/
        index.astro                  /writing/
        about.astro                  /writing/about
        blog/
          index.astro                /writing/blog
          [slug].astro               /writing/blog/<slug>
        projects/
          index.astro   [slug].astro
        eidos/
          index.astro   [slug].astro
        rss.xml.ts                   /writing/rss.xml
    components/
      GearBackground.tsx             island, client:idle
      CategoryFilter.tsx             island, client:load
    content.config.ts                collections + Zod schemas
  content/
    blog/  projects/  eidos/  about.md
  claims.yaml
  scripts/
    content-gate.mjs  content-gate.test.mjs
```

**`base` stays `/`.** This is the one structural subtlety worth stating plainly: Astro's
`base` option applies to the entire site, so setting it to `/writing` would move the
treatise as well. The essays get their prefix from living under `src/pages/writing/`
instead. `BASE_PATH`, `withBase()`, and `absoluteUrl()` are therefore **deleted, not
ported** — the prefix stops being a computed value and becomes a directory name, which
is the whole reason this arrangement is better than the one it replaces.

---

## What Astro replaces

The migration's value is concentrated here. Each of these is machinery that exists only
because a client-rendered SPA had to be made crawlable after the fact.

| Deleted | Replaced by |
| --- | --- |
| `scripts/prerender.ts` (~270 lines; 12 pages, `404.html`, `rss.xml`, `sitemap.xml`) | file-based static routes, `@astrojs/rss`, `@astrojs/sitemap` |
| Hand-rolled frontmatter assertions in the prerender | content collection Zod schemas, enforced at build |
| `src/lib/content.ts` — the `import.meta.glob` loaders | `getCollection()` |
| `src/lib/markdown.ts` — `marked` + `highlight.js` config | Astro's remark pipeline + Shiki |
| `src/lib/escape.ts` — HTML/XML escaping for hand-built strings | Astro's own escaping |
| `src/lib/site.ts` — `BASE_PATH`, `withBase`, `absoluteUrl` | directory structure + `Astro.site` |
| react-router, the SPA shell, the `404.html` fallback trick | file-based routing and a real `404.astro` |
| `vite.config.ts` | `astro.config.mjs` |
| The React-19-adopts-prerendered-`<meta>` constraint | irrelevant; there is no hydration of the document head |

Four runtime dependencies leave with them: `marked`, `highlight.js`, `react-router-dom`,
and eventually `react-dom` outside the islands.

## What is ported rather than deleted

| Kept | Becomes |
| --- | --- |
| `GearBackground.tsx` + `src/lib/gear-*.ts` + `gears.ts` | React island, `client:idle`, on a shared writing layout |
| `CategoryFilter.tsx` and the category/tag URL-param logic in `Blog.tsx` | React island, `client:load` |
| `src/lib/dates.ts` | kept as-is — the UTC bug it fixes is real and Astro does not fix it |
| The draft rule (`isPublished`) | a `getCollection` filter |
| Root-relative content link rewriting | a ~15-line remark plugin |

The link rewriting earns its keep: there are four root-relative links in content today
(`/eidos`, `/eidos/form-template`, `/eidos/infrastructure`) and the alternative is
requiring every future author to remember a `/writing` prefix that the directory
structure is supposed to be handling.

Islands require `@astrojs/react`, which the treatise does not currently have. It is the
only new integration.

---

## Risks

**1. Pages shadowing at cutover — the one that can actually break the site.**
`adbarc92/writing` currently has Pages enabled and serves a *project* site at
`/writing/`. A project site takes precedence over the same path in the user site, so
after the merged build publishes, `/writing/*` will still be served by the old
deployment until Pages is disabled on that repository. Cutover is therefore not "merge
and done" — it is an ordered sequence with a window where the wrong thing serves. This
is the reason the cutover section below exists.

**2. Syntax highlighting changes.** `highlight.js` with the `github-dark` theme is
replaced by Astro's Shiki. The exposure is small and worth measuring before worrying:
three code blocks across two files (`hello-world.md`, `eidos/03-form-template.md`).
Accepted deliberately rather than ported.

**3. Markdown output differences.** `marked` and remark do not produce byte-identical
HTML. `.prose` in `src/index.css` is written against `marked`'s output and will need a
pass. Low severity, but it is the most likely source of small visual regressions, so it
gets its own verification step rather than being folded into another.

**4. Three.js in an island.** The background is ~2 MB and currently sits in the main
bundle on every route. As an island it is at least deferrable — `client:idle` keeps it
off the critical path. Worth confirming it does not regress the treatise's Lighthouse
floor, since the treatise is the page with the ≥ 95 bar and it must not load this at all.

**5. Orphaned pull requests.** Five are open across the two repositories. Consolidation
rewrites the ground under all of them. They land first; see Phase 0.

**6. Two test runners.** Vitest (41 tests) and `node:test` (11). The merged repo should
have one. Vitest, because it is the larger suite and Astro supports it first-class via
`getViteConfig`; the content-gate tests port across with no behavioural change.

---

## Phases

Each phase ends green — build passes, tests pass, and the live site is untouched until
Phase 7. Nothing here is a cutover except Phase 7.

**Phase 0 — Land or close the open PRs.** `writing` #3 (relabel), #4 (essay drafts), #5
(plan corrections); `portfolio-treatise` #1 (Essays section), #2 (embargo lift). All
five predate the merge and become difficult to reason about after it.

**Phase 1 — Scaffold.** Add `@astrojs/react`, `@astrojs/rss`, `@astrojs/sitemap` to the
treatise. Confirm the treatise still builds and the content gate still passes. No
writing-site code yet.

**Phase 2 — Content and collections.** Move `content/` across. Define
`content.config.ts` with Zod schemas encoding what the prerender asserted by hand: the
closed `Category` union, the required fields, the optional draft flag. A malformed
frontmatter file must fail the build, as it does today.

**Phase 3 — Routes.** `/writing/*` pages, static output, no islands yet. Verify every
URL that exists today still exists, by diffing the emitted route list against the
current `sitemap.xml`.

**Phase 4 — Islands.** Gear background and category filter. Verify the treatise ships no
React.

**Phase 5 — Feed, sitemap, metadata parity.** `rss.xml` at the same path with the same
items; `sitemap.xml` covering the treatise *and* the essays, which it cannot today; per
page `<title>`, description, canonical, OG, and `twitter:card`. Verified by diffing
`<head>` against the current live pages, not by inspection.

**Phase 6 — Gates and tests.** One runner. Content gate runs over the merged `dist/`,
which now includes the essays — expect it to have opinions about prose it has never
scanned before.

**Phase 7 — Cutover.** Below.

**Phase 8 — Cleanup.** Archive `adbarc92/writing`. Fold its `docs/` into the merged repo
so this document and the plans it supersedes stay reachable. Rewrite `CLAUDE.md` and
`AGENT-PROMPT.md` for the merged reality, including the gate table above.

---

## Cutover

Ordered, because the shadowing risk is real:

1. Merged build is green and deployed to a preview or verified locally against
   `dist/`.
2. Diff the emitted route list against the current live `sitemap.xml`. Any missing route
   is a stop.
3. Deploy the merged build to `adbarc92.github.io`. At this moment the root updates and
   `/writing/*` is still served by the old project site — both are correct, so the site
   is not broken during the window.
4. Disable Pages on `adbarc92/writing`.
5. Verify `/writing/blog/eidos-an-architecture-for-cheap-code/` returns 200 from the new
   deployment, with `og:image` and canonical intact.
6. Verify `/writing/rss.xml` and `/writing/sitemap.xml`.

**Rollback.** Re-enable Pages on `adbarc92/writing`; it reclaims `/writing/*`
immediately, and the treatise root is unaffected because it is a separate deployment.
The old repository is archived rather than deleted precisely so this remains possible.

---

## Deliberately deferred

- **Renaming the repository** to something that describes what it now holds. It breaks
  remote URLs and every open PR, and it is worth nothing until the merge has settled.
- **The link gate and the rendered-page claims gate.** Documented, never built. The
  merged repo is a better place to build them, since one gate would then cover both
  halves of the site — but building them is not migration work and should not be
  smuggled into it.
- **Redirects** from any future prettier URL to `/writing/*`. Not needed while the paths
  do not change.
