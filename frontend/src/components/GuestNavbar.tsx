import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { ThemeMenuButton } from './ThemeMenuButton';

type MenuItem = {
  label: string;
  path: string;
};

const AUDIENCE_ITEMS: MenuItem[] = [
  { label: 'Для психолога', path: '/' },
  { label: 'Для клиента', path: '/for-clients' },
  { label: 'Для исследователя', path: '/for-researchers' },
  { label: 'Сообщество', path: '/communities' },
];

export function GuestNavbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const cabinetPath =
    user?.role === 'client'
      ? '/client'
      : user?.role === 'admin'
        ? '/admin'
        : user?.role === 'psychologist'
          ? '/psychologist'
          : user?.role === 'researcher'
            ? '/researcher'
            : user?.role === 'guest'
              ? '/guest'
              : '/dashboard';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10000,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--navbar-edge)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            gap: 12,
            minWidth: 0,
          }}
        >
          <div className="guest-navbar-logo" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <BrandLogo to="/" />
          </div>

          <div
            className="guest-desktop-menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: 1,
              minWidth: 0,
              justifyContent: 'center',
            }}
          >
            {AUDIENCE_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 600,
                  background: isActive(item.path) ? 'var(--surface-2)' : 'transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div
            className="navbar-right-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          >
            {user ? (
              <Link
                to={cabinetPath}
                className="button"
                style={{ padding: '8px 14px', fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                Личный кабинет
              </Link>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Link
                  to="/login"
                  className="button secondary"
                  style={{ padding: '8px 12px', fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Войти
                </Link>
                <Link
                  to="/register"
                  className="button"
                  style={{ padding: '8px 12px', fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Попробовать бесплатно
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 20,
              }}
            >
              {mobileMenuOpen ? '×' : '☰'}
            </button>
          </div>
        </div>

        {mobileMenuOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="mobile-menu"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(5,8,16,0.8)',
                backdropFilter: 'blur(6px)',
                zIndex: 99999,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
              onClick={() => setMobileMenuOpen(false)}
            >
              <div
                style={{
                  width: '80%',
                  maxWidth: 320,
                  background: 'var(--surface)',
                  padding: '12px 16px',
                  borderLeft: '1px solid var(--navbar-edge)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 0 10px',
                    borderBottom: '1px solid var(--navbar-edge)',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>Меню</div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: 24,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: '8px 0 12px', borderBottom: '1px solid var(--navbar-edge)' }}>
                  <ThemeMenuButton compact={false} />
                </div>
                {AUDIENCE_ITEMS.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontWeight: 600,
                      background: isActive(item.path) ? 'var(--surface-2)' : 'transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>,
            document.body
          )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .mobile-menu-button { display: flex !important; }
          .guest-desktop-menu { display: none !important; }
          .guest-navbar-logo img { height: 44px !important; }
          .guest-navbar-logo .brand-logo-text { font-size: 15px !important; }
        }
        @media (max-width: 520px) {
          .guest-navbar-logo .brand-logo-text { display: none !important; }
        }
        @media (max-width: 380px) {
          .navbar-right-actions .button {
            padding: 7px 8px !important;
            font-size: 12px !important;
          }
        }
      `}</style>
    </nav>
  );
}
