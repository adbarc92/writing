import { parse as parseYaml } from 'yaml';
import { marked, type Tokens } from 'marked';
import hljs from 'highlight.js';
import { withBase } from './site';

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
      // absolute URLs, mailto:, and #anchors are left exactly as authored.
      const resolved = href.startsWith('/') ? withBase(href) : href;
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${title}"` : '';
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
