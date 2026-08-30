# Project Status — Portfolio (`adbarc92/writing`)

## State summary

_Last updated: 2026-08-30_

**TL;DR.** The consolidation is absorbing this site onto Astro, so **the active code work is no
longer in this repository**. Phases 1 and 2 are merged; phases 3 and 4 are open as a stacked pair.
The live essays site is untouched and unchanged — nothing in the consolidation has deployed.

**Where the work is.** The survivor repository is named **`portfolio-treatise`**. Its working clone
sits at `portfolio-website/` inside this repo and is gitignored — the directory name and the
repository name do not match, which is the single most common way to get lost here. It is
**private**, so it will not appear unless you are browsing your own repositories signed in.

| Repo | Role | Visibility |
| --- | --- | --- |
| `adbarc92/writing` | this one — being absorbed; still serving `/writing/` | public |
| `adbarc92/portfolio-treatise` | the survivor; clone at `portfolio-website/` | private |
| `adbarc92/adbarc92.github.io` | publish target, build output only | public |

**Phases**

| | Phase | State |
| --- | --- | --- |
| 0 | Land the five orphaned PRs | done |
| 1 | Scaffold — React, RSS, sitemap integrations | merged 2026-08-30 |
| 2 | Content and collections | merged 2026-08-30 |
| 3 | `/writing/*` routes, static | **PR #6, open** |
| 4 | Islands — category filter | **PR #7, open, stacked on #6** |
| 5 | Feed, sitemap, metadata parity | next |
| 6 | Gates and tests onto one runner | pending |
| 7 | Cutover | pending |
| 8 | Cleanup — archive this repo, fold in docs | pending |

**Readiness**

| Check | State |
| --- | --- |
| This repo — build / tests | green; 41 tests |
| Treatise — build / tests / gate | green; 70 tests; content gate clean |
| Route parity vs. live `sitemap.xml` | identical — all 12 URLs emitted, none added |
| Treatise page under the merged build | byte-identical to its pre-change build; ships no React |
| Live essays (`/writing/*`) | 200, HTTPS enforced, OG card verified |
| Treatise CI | **broken — 8 runs, 8 failures, never once succeeded** |

**Scope change made in phase 4.** The design doc pairs the category filter with the gear
background. Only the filter was built. Porting ~1,700 lines and a ~2 MB Three.js bundle that is
already slated for redesign would be careful work spent carrying across the thing being replaced,
so **the background becomes its own phase and will be built natively in Astro rather than ported**.
The `/writing/*` pages currently have no background.

**Known gaps**

- **The filter island has not been checked in a browser.** Its rules and its rendering are covered
  by tests and its hydration wiring is present in the output, but no browser has clicked a chip.
- **Treatise CI has never worked.** Every deploy has been manual via `npm run deploy`. A merge
  deploys nothing. Probable cause is exhausted Actions minutes on a private repo; unconfirmed
  because the billing API needs a `user` scope the local token lacks. Making the merged repo
  public — already a fixed decision — would fix this for free.
- **The treatise repo has zero Actions secrets.** `PAGES_DEPLOY_TOKEN` is absent, and the CI deploy
  job guards on it, so that job could never have succeeded either.
- The two political essays are `draft: true` and not publishable: prose drafted from the approved
  abstracts rather than written, and every figure in *The Price of the Ticket* needs a source.
- Two of the four CI gates `AGENT-PROMPT.md` documents were never built — the link gate and the
  rendered-page claims gate.
- The React runtime is ~187 KB (~61 KB gzipped) on the blog index, to filter two published posts.
  Named rather than decided.
- `og:image` is a single site-wide card.

**Next steps**

1. Review the stacked pair, `portfolio-treatise` #6 then #7.
2. Click a chip in `npm run dev` before #7 merges — the one thing tests cannot cover.
3. Phase 5 — feed, sitemap, and metadata parity, verified by diffing `<head>` against the live
   pages rather than by inspection.
4. Decide the treatise's repo visibility; going public also fixes the CI failure for free.
5. The gear redesign, as its own phase — more abstract, matched to the landing page.
6. Post the Eidos essay — run it through LinkedIn's Post Inspector first to prime the cache.

---

## Session log

### 2026-08-30 — Consolidation phases 3 and 4

Built the essay routes and the category filter in `portfolio-treatise`. Opened as a stacked pair,
#6 then #7. Nothing deployed.

- **Phase 3 — routes.** Eight page files under `src/pages/writing/` emitting the twelve URLs the
  live sitemap lists, verified by diffing the emitted route list against it rather than by
  inspection. The prefix comes from the directory, not from config: `base` stays `"/"` so the
  treatise does not move with it. Three plain modules carry logic the structure cannot: UTC date
  formatting, the draft rule, and a remark plugin restoring the `/writing` prefix on the four
  root-relative links content authors already wrote.
- **Fixed a latent defect in the content gate.** Pointing it at essay prose for the first time
  failed the build twice, on text mentioning nothing retracted — `rediscovered` matched "Redis" as
  a substring, and `restored is` matched it once whitespace was stripped. Both were false positives
  from an unbounded matcher. Terms now match on word boundaries while still tolerating mangling, so
  `R-e-d-i-s` and `ChromeWebStore` are still caught. No term was removed; scoping was not available
  as the fix, because the false positives were in reader-facing prose.
- **Phase 4 — the filter island, narrowed.** Only the category filter was built. The gear
  background was left for its own phase rather than ported, since it is already slated for
  redesign. The island server-renders, so a reader without JavaScript still sees every essay.
- **Corrected this document**, which had described phases 1 and 2 as unreviewed open PRs some hours
  after they merged, and clarified that the survivor repository is named `portfolio-treatise` while
  its clone directory is `portfolio-website`.

### 2026-08-29 — Embargo lift, funnel closed, consolidation begun

Long session across three repositories. Full detail in
[`handoffs/fd313ec2-4ab1-4de7-806e-bd92f74a42b1.md`](handoffs/fd313ec2-4ab1-4de7-806e-bd92f74a42b1.md).

- **Lifted the embargo** in the treatise. The gate was doing three jobs and only one was the
  embargo — it also holds the retracted-claims list and the banned vocabulary, neither of which
  lifted — so it was renamed `content-gate.mjs` and kept rather than deleted, and its canary was
  promoted from a CLI flag into real tests.
- **Closed the funnel.** The front page had no path to the essays. The cause was not a missing
  link: the Essays section was gated on `url: ""`, exactly as designed. Filling it opened the
  section. Discovered while verifying that **the treatise's CI has never once succeeded** and every
  deploy has been manual — the merge alone would not have shipped it. Deployed by hand; the root
  now links to Eidos.
- **Drafted the two political-economy essays** the treatise had specified since July, under the
  `politics` category, `draft: true`.
- **Corrected documentation drift** in both repos: two plan premises that later tasks overturned,
  and a deploy target that was never used.
- **Began consolidation.** Design merged; phases 1 and 2 built. Registering React broke the content
  gate on `case"seamless":` inside React's attribute table, which surfaced a real defect — the two
  term lists needed different scopes, and now have them.

### 2026-08-28 — Repo hygiene and documentation refresh

Audited the repo and reconciled git, GitHub, and the docs. Found `CLAUDE.md` badly drifted from reality and the local branch topology pointing at the wrong remote.

- Rewrote `CLAUDE.md` against verified facts: the gear background is Three.js/WebGL (not SVG), a test framework *is* configured (Vitest, 40 tests), the build ends in a prerender step, the content pipeline is split across `markdown`/`frontmatter`/`site`/`dates`/`escape`, and the pages list now includes Eidos. Replaced the obsolete `master` / `new` branch section with a Remotes and branches section that spells out which repository actually publishes what.
- Retargeted local `main` onto this project's `main` (verified lossless — it was a strict ancestor) and repointed its upstream away from the treatise repo.
- Deleted the merged `feat/essays-and-taxonomy` and `fix/og-card-and-contact-links` branches.
- Dropped the treatise repository as a remote and renamed `writing` → `origin`, so bare `git push` / `git fetch` now act on this project rather than on the treatise's publish branch.
- Enabled HTTPS enforcement on the repo's Pages settings (`https_enforced` was `false`).
- Added `portfolio-website.zip` to `.gitignore`.
- Created this file.

### 2026-08-15 — Open Graph card and real contact links (PR #1)

Closed the two gaps that stood between the site and being worth promoting.

- Generated a 1200×630 Open Graph card in the site palette and set `SITE.image`; the existing prerender wiring picked it up and flipped `twitter:card` to `summary_large_image`.
- Replaced the `yourusername` placeholders on `/about` with the real GitHub and LinkedIn profiles.
- Marked the essays-and-taxonomy plan as shipped and corrected the design doc's status header.

### Earlier — Essays, taxonomy, and the Eidos section

Fifteen-task plan delivered across `feat/essays-and-taxonomy`: category taxonomy and draft state, prose styles, the Eidos essay and its four specification documents, category filtering, per-page head metadata, static prerendering, RSS and sitemap, a Vitest suite for the pure logic, and the move to serving from `/writing` as a Pages project site. See [`plans/2026-08-10-essays-and-taxonomy-plan.md`](plans/2026-08-10-essays-and-taxonomy-plan.md).
