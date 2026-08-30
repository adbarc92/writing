# Project Status — Portfolio (`adbarc92/writing`)

## State summary

_Last updated: 2026-08-30_

**TL;DR.** A consolidation is under way: `adbarc92/portfolio-treatise` is absorbing this site onto
Astro, so **the active code work is no longer in this repository**. It is in `portfolio-website/`,
a gitignored clone of the treatise repo nested inside this one. Phases 1 and 2 are done and
awaiting review as a stacked pair. The essays site itself is live and unchanged.

**Where the work is**

| Repo | Role | Visibility |
| --- | --- | --- |
| `adbarc92/writing` | this one — being absorbed; still serving `/writing/` | public |
| `adbarc92/portfolio-treatise` | the survivor; clone at `portfolio-website/` | private |
| `adbarc92/adbarc92.github.io` | publish target, build output only | public |

**Readiness**

| Check | State |
| --- | --- |
| This repo — build / tests | green; 41 tests |
| Treatise — build / tests / gate | green; 21 tests; content gate clean |
| Live essays (`/writing/*`) | 200, HTTPS enforced, OG card verified |
| Live root | shows `III. Essays` linking to the Eidos essay; no draft badge |
| Treatise CI | **broken — 8 runs, 8 failures, never once succeeded** |

**Open PRs.** `portfolio-treatise` #3 (phase 1, scaffold → `main`) and #4 (phase 2, content →
#3's branch), stacked and unreviewed. None open here.

**Known gaps**

- **Treatise CI has never worked.** Every deploy has been manual via `npm run deploy`. A merge
  deploys nothing. Probable cause is exhausted Actions minutes on a private repo; unconfirmed
  because the billing API needs a `user` scope the local token lacks.
- The two political essays are `draft: true` and not publishable: prose drafted from the approved
  abstracts rather than written, and every figure in *The Price of the Ticket* needs a source.
- Two of the four CI gates `AGENT-PROMPT.md` documents were never built — the link gate and the
  rendered-page claims gate.
- **The treatise repo has zero Actions secrets.** `EMBARGO_TERMS` is gone, but so is
  `PAGES_DEPLOY_TOKEN`, which the CI deploy job guards on — so that job could never have
  succeeded either, independently of whatever stops the build job from running any steps.
- `og:image` is a single site-wide card; the Three.js bundle is ~2.0 MB (~596 KB gz).

**Next steps**

1. Review the stacked pair, `portfolio-treatise` #3 then #4.
2. Phase 3 — the `/writing/*` routes. See the handoff brief for the exact starting command and the
   verification the phase must pass.
3. Decide the treatise's repo visibility; going public also fixes the CI failure for free.
4. Post the Eidos essay — run it through LinkedIn's Post Inspector first to prime the cache.

---

## Session log

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
