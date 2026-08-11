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

  it('leaves a protocol-relative href untouched', () => {
    expect(parseMarkdown('[cdn](//example.com/a)').html).toContain('href="//example.com/a"');
  });

  it('escapes a double quote in a link title', () => {
    expect(parseMarkdown(`[x](/a 'a "quoted" title')`).html)
      .toContain('title="a &quot;quoted&quot; title"');
  });

  it('does not double-prefix an href already under the base path', () => {
    expect(parseMarkdown('[x](/writing/eidos)').html).toContain('href="/writing/eidos"');
  });
});
