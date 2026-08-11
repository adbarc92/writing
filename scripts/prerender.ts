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
import { isPublished } from '../src/lib/frontmatter';
import { SITE, pageTitle, DESCRIPTIONS, absoluteUrl, BASE_PATH } from '../src/lib/site';
import { escapeAttr, escapeXml } from '../src/lib/escape';

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

function readCollection<T>(dir: string, slugFn: (path: string) => string) {
  const full = join(CONTENT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const raw = readFileSync(join(full, file), 'utf8');
      const { frontmatter, html } = parseMarkdown<T>(raw);
      return { slug: slugFn(file), file, frontmatter, html };
    });
}

const blogEntries = readCollection<BlogFrontmatter>('blog', slugFromDatedPath);

const posts = blogEntries
  .filter(p => isPublished(p.frontmatter, false))
  .sort(
    (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
  );

const projects = readCollection<ProjectFrontmatter>('projects', slugFromDatedPath).sort(
  (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
);

const eidosDocs = readCollection<EidosFrontmatter>('eidos', slugFromOrderedPath).sort(
  (a, b) => a.frontmatter.order - b.frontmatter.order
);

const ABOUT_PATH = join(CONTENT, 'about.md');
const aboutBody = existsSync(ABOUT_PATH)
  ? parseMarkdown(readFileSync(ABOUT_PATH, 'utf8')).html
  : '';

const pages: Page[] = [
  { route: '/', title: pageTitle(), description: SITE.description, body: '', type: 'website' },
  {
    route: '/blog',
    title: pageTitle('Writing'),
    description: DESCRIPTIONS.blog,
    body: '',
    type: 'website',
  },
  {
    route: '/projects',
    title: pageTitle('Projects'),
    description: DESCRIPTIONS.projects,
    body: '',
    type: 'website',
  },
  {
    route: '/about',
    title: pageTitle('About'),
    description: SITE.description,
    body: aboutBody,
    type: 'website',
  },
  {
    route: '/eidos',
    title: pageTitle('Eidos'),
    description: DESCRIPTIONS.eidos,
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
  const url = absoluteUrl(page.route);
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
    `<link rel="alternate" type="application/rss+xml" title="${escapeAttr(SITE.title)}" href="${SITE.origin}${BASE_PATH}/rss.xml" />`,
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

const rssItems = posts
  .map(p => {
    const url = absoluteUrl('/blog/' + p.slug);
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
    <link>${absoluteUrl('/blog')}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>en</language>
    <atom:link href="${SITE.origin}${BASE_PATH}/rss.xml" rel="self" type="application/rss+xml" />
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
${pages.map(p => `  <url><loc>${escapeXml(absoluteUrl(p.route))}</loc></url>`).join('\n')}
</urlset>
`,
  'utf8'
);

// --- Build-time validation --------------------------------------------------
// There is no test runner, so a malformed content file must fail the build
// here rather than ship a page that silently renders blank. Runs after every
// file above has been written; a failure below still fails `npm run build`.

function assertField(condition: unknown, file: string, message: string): void {
  if (!condition) {
    throw new Error(`prerender: ${file}: ${message}`);
  }
}

// 1. The shell must have actually contained the injection point, or every
// `.replace('<div id="root"></div>', ...)` above silently no-opped and every
// page just shipped the bare shell.
assertField(
  shell.includes('<div id="root"></div>'),
  'dist/index.html',
  'shell is missing \'<div id="root"></div>\' — body injection silently no-opped for every page'
);

// 2. Every generated page needs a real title and description.
for (const page of pages) {
  assertField(page.title.trim(), page.route, 'generated page has an empty or missing title');
  assertField(
    page.description.trim(),
    page.route,
    'generated page has an empty or missing description'
  );
}

// 3. Every blog post (including drafts) needs complete, valid frontmatter.
for (const post of blogEntries) {
  const fm = post.frontmatter;
  assertField(fm.date, post.file, 'missing "date" in frontmatter');
  assertField(
    fm.date && !Number.isNaN(new Date(fm.date).getTime()),
    post.file,
    `"date" in frontmatter is not a valid date: ${JSON.stringify(fm.date)}`
  );
  assertField(fm.excerpt, post.file, 'missing "excerpt" in frontmatter');
  assertField(fm.tags, post.file, 'missing "tags" in frontmatter');
  assertField(fm.category, post.file, 'missing "category" in frontmatter');
}

// 4. Every Eidos document needs complete frontmatter.
for (const doc of eidosDocs) {
  const fm = doc.frontmatter;
  assertField(fm.title, doc.file, 'missing "title" in frontmatter');
  assertField(
    typeof fm.order === 'number' && !Number.isNaN(fm.order),
    doc.file,
    'missing or invalid "order" in frontmatter'
  );
  assertField(fm.version, doc.file, 'missing "version" in frontmatter');
  assertField(fm.summary, doc.file, 'missing "summary" in frontmatter');
}

console.log(`prerender: wrote ${count} pages + 404.html, rss.xml, sitemap.xml`);
