/** Shared by the app and by scripts/prerender.ts. Keep free of import.meta. */
export const SITE = {
  origin: 'https://alexanderdbarclay.com',
  title: 'Alex Barclay',
  author: 'Alex Barclay',
  description:
    'Software engineering, machine learning, and robotics — essays, projects, and the Eidos architecture.',
  /** Absolute path under public/, e.g. '/images/og.png'. Unset until one exists. */
  image: '/images/og.png' as string | undefined,
};

export function pageTitle(page?: string): string {
  return page ? `${page} — ${SITE.title}` : SITE.title;
}

/**
 * Descriptions shared between the page components and scripts/prerender.ts.
 * React 19 only adopts a prerendered <meta> when name and content match
 * exactly, so a copy that drifts from its pair appends a second, conflicting
 * description tag instead of erroring. Single-sourced here to make that
 * impossible.
 */
export const DESCRIPTIONS = {
  blog: 'Essays on software, fiction, and whatever else holds still long enough.',
  projects: 'Selected work across software engineering, machine learning, and robotics.',
  eidos:
    'An architecture for cheap code: humans design the Forms, agents fill them, fitness functions verify the fit.',
} as const;

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
