import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/blog', label: 'Essays' },
  { to: '/eidos', label: 'Eidos' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
];

export default function NavBar() {
  const location = useLocation();

  if (location.pathname === '/') return null;

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 2rem',
      background: 'rgba(15, 17, 23, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-gear-stroke)',
    }}>
      <Link to="/" style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.02em' }}>
        Alex Barclay
      </Link>
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {links.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            style={{
              color: location.pathname.startsWith(to) ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontSize: '0.9rem',
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'color 0.2s',
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
