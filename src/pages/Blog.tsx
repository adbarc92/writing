import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  loadBlogPosts,
  CATEGORIES,
  type Category,
  type ContentEntry,
  type BlogFrontmatter,
} from '../lib/content';
import BlogCard from '../components/BlogCard';
import CategoryFilter from '../components/CategoryFilter';
import { pageTitle, DESCRIPTIONS } from '../lib/site';

function asCategory(value: string | null): Category | null {
  return CATEGORIES.some(c => c.id === value) ? (value as Category) : null;
}

export default function Blog() {
  const [posts, setPosts] = useState<ContentEntry<BlogFrontmatter>[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCategory = asCategory(searchParams.get('category'));
  const activeTag = searchParams.get('tag');

  useEffect(() => {
    loadBlogPosts().then(p => { setPosts(p); setLoading(false); });
  }, []);

  // The tag filter narrows the pool the chips describe, so their counts always
  // match what clicking them would actually show.
  const pool = useMemo(
    () => (activeTag ? posts.filter(p => p.frontmatter.tags.includes(activeTag)) : posts),
    [posts, activeTag]
  );

  const counts = useMemo(() => {
    const result: Partial<Record<Category, number>> = {};
    for (const post of pool) {
      const c = post.frontmatter.category;
      result[c] = (result[c] ?? 0) + 1;
    }
    return result;
  }, [pool]);

  const visible = activeCategory
    ? pool.filter(p => p.frontmatter.category === activeCategory)
    : pool;

  function selectCategory(category: Category | null) {
    const next = new URLSearchParams(searchParams);
    if (category) next.set('category', category);
    else next.delete('category');
    setSearchParams(next, { replace: true });
  }

  return (
    <div style={{ padding: '6rem 2rem 2rem', maxWidth: '48rem', margin: '0 auto' }}>
      <title>{pageTitle('Essays')}</title>
      <meta name="description" content={DESCRIPTIONS.blog} />
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>Essays</h1>

      {activeTag && (
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Tagged &ldquo;{activeTag}&rdquo; &middot;{' '}
          <Link to="/blog">clear</Link>
        </p>
      )}

      {!loading && (
        <CategoryFilter
          counts={counts}
          active={activeCategory}
          total={pool.length}
          onSelect={selectCategory}
        />
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : visible.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Nothing here yet. <Link to="/blog">Show everything</Link>
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {visible.map(post => (
            <BlogCard key={post.slug} slug={post.slug} frontmatter={post.frontmatter} />
          ))}
        </div>
      )}
    </div>
  );
}
