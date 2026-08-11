import { parse as parseYaml } from 'yaml';
import { marked, type Tokens } from 'marked';
import hljs from 'highlight.js';
import { withBase, BASE_PATH } from './site';
import { escapeAttr } from './escape';

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
    link({ href, title, tokens }: Tokens.Link): string {
      // Root-relative hrefs in content are app paths and need the base path;
      // protocol-relative (`//host/...`), absolute URLs, mailto:, and #anchors
      // are left exactly as authored, and an href already under the base path
      // is left alone too, so content is never doubled up.
      const isRootRelative = href.startsWith('/') && !href.startsWith('//');
      const alreadyBased = href === BASE_PATH || href.startsWith(`${BASE_PATH}/`);
      const resolved = isRootRelative && !alreadyBased ? withBase(href) : href;
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<a href="${resolved}"${titleAttr}>${text}</a>`;
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
