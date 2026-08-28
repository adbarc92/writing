# Project Status — Portfolio (`adbarc92/writing`)

## State summary

_Last updated: 2026-08-28_

**TL;DR.** The Eidos essay and its four-document specification are published, prerendered, and live at `alexanderdbarclay.com/writing/`. Shared links unfurl with a real Open Graph card and `/about` points at real accounts, so the site is ready to promote. No work is in flight.

**Readiness**

| Check | State |
| --- | --- |
| `npm run build` | green — tsc → vite → prerender (12 pages + `404.html`, `rss.xml`, `sitemap.xml`) |
| `npm run test` | 40 passing across 5 files |
| Deploy | GitHub Pages via `.github/workflows/deploy.yml`; last successful run 2026-08-15 |
| HTTPS | enforced; certificate valid through 2026-10-30 |
| Live routes | `/`, `/blog/*`, `/eidos`, `/about`, `/rss.xml` all 200 |
| Social unfurl | `og:image` + `twitter:card=summary_large_image` verified on the live essay |

**Open PRs.** None. PR #1 (OG card and contact links) merged 2026-08-15.

**Known gaps**

- A stale `feat/essays-and-taxonomy` branch still exists on the `adbarc92.github.io` repo (harmless, but it is a copy of this project's source in the treatise's repository).
- `og:image` is a single site-wide card. There are no per-post images.
- The main JS bundle is ~2.0 MB (~596 KB gzipped), dominated by Three.js. No code-splitting.
- `.claude/settings.json` sits untracked with machine-absolute paths in its allowlist; decide whether to ignore it or move it to `settings.local.json`.

**Next steps**

1. Post the essay; run the URL through LinkedIn's Post Inspector first to prime its cache.
2. Optional: code-split the Three.js background to cut first load.
3. Optional: delete the stale `feat/essays-and-taxonomy` branch from the `adbarc92.github.io` repo.

---

## Session log

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
