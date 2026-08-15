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
      .toBe('https://alexanderdbarclay.com/writing/blog/eidos-an-architecture-for-cheap-code');
  });

  it('builds the site root correctly', () => {
    expect(absoluteUrl('/')).toBe('https://alexanderdbarclay.com/writing/');
  });

  it('never emits a double slash after the origin', () => {
    expect(absoluteUrl('/blog').replace('https://', '')).not.toContain('//');
  });

  it('resolves the og:image to an absolute URL under the base path', () => {
    // Crawlers reject a relative og:image, and the asset lives under the
    // project-site subpath rather than the domain root.
    expect(absoluteUrl(SITE.image!)).toBe('https://alexanderdbarclay.com/writing/images/og.png');
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
