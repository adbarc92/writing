import { Link } from 'react-router-dom';
import { pageTitle, SITE } from '../lib/site';

const navItems = [
  { to: '/blog', label: 'Essays' },
  { to: '/eidos', label: 'Eidos' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];

export default function Landing() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      gap: '1rem',
    }}>
      <title>{pageTitle()}</title>
      <meta name="description" content={SITE.description} />
      <h1 style={{
        fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--color-text)',
      }}>
        Alex Barclay
      </h1>
      <p style={{
        fontSize: 'clamp(1rem, 2vw, 1.3rem)',
        color: 'var(--color-text-muted)',
        fontWeight: 300,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Software Engineer
      </p>
      <nav style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
        {navItems.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            style={{
              color: 'var(--color-accent)',
              fontSize: '0.95rem',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '0.5rem 1rem',
              border: '1px solid var(--color-accent-dim)',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
