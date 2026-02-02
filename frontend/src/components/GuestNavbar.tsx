import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type MenuItem = {
  label: string;
  path?: string;
  icon?: string;
  children?: Array<{ label: string; path: string; icon?: string }>;
};

export function GuestNavbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuItems: MenuItem[] = [
    {
      label: 'Главная',
      path: '/',
      icon: '🏠'
    },
    {
      label: 'Психологи',
      path: '/psychologists',
      icon: '👨‍⚕️'
    },
    {
      label: 'Тесты',
      path: '/guest/tests',
      icon: '📊'
    },
    {
      label: 'Форум',
      path: '/guest/community',
      icon: '💬'
    },
    {
      label: 'Публикации',
      path: '/guest/publications',
      icon: '📚'
    },
    {
      label: 'Мои сны',
      path: '/guest/dreams',
      icon: '💭'
    }
  ];

  const handleMouseEnter = (label: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoveredMenu(label);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredMenu(null);
    }, 150);
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setHoveredMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav
      ref={menuRef}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text)' }}>
            <div style={{ fontSize: 28 }}>🧠</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>JungAI</div>
          </Link>

          {/* Desktop Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
            {menuItems.map((item) => {
              if (item.children) {
                return (
                  <div
                    key={item.label}
                    style={{ position: 'relative' }}
                    onMouseEnter={() => handleMouseEnter(item.label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      style={{
                        padding: '8px 16px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: hoveredMenu === item.label ? 'var(--surface-2)' : 'transparent',
                        color: 'var(--text)',
                        fontSize: 14,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s'
                      }}
                    >
                      {item.icon && <span>{item.icon}</span>}
                      <span>{item.label}</span>
                    </div>
                    {hoveredMenu === item.label && item.children && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 8,
                          background: 'var(--surface)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                          padding: 8,
                          minWidth: 200,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                          zIndex: 1000
                        }}
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '10px 12px',
                              borderRadius: 8,
                              textDecoration: 'none',
                              color: 'var(--text)',
                              fontSize: 14,
                              background: isActive(child.path) ? 'var(--surface-2)' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                          >
                            {child.icon && <span>{child.icon}</span>}
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={item.path || item.label}
                  to={item.path || '#'}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 600,
                    background: isActive(item.path) ? 'var(--surface-2)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s'
                  }}
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              <Link 
                to={
                  user.role === 'client' ? '/client' :
                  user.role === 'psychologist' || user.role === 'admin' ? '/psychologist' :
                  user.role === 'researcher' ? '/researcher' :
                  user.role === 'guest' ? '/guest' :
                  '/dashboard'
                } 
                className="button" 
                style={{ padding: '8px 16px', fontSize: 14, textDecoration: 'none' }}
              >
                Личный кабинет
              </Link>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/login" className="button secondary" style={{ padding: '8px 16px', fontSize: 14, textDecoration: 'none' }}>
                  Войти
                </Link>
                <Link to="/register" className="button" style={{ padding: '8px 16px', fontSize: 14, textDecoration: 'none' }}>
                  Регистрация
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 24,
              cursor: 'pointer',
              padding: 8
            }}
            className="mobile-menu-btn"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: '16px 0',
              borderTop: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            {menuItems.map((item) => (
              <Link
                key={item.path || item.label}
                to={item.path || '#'}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 600,
                  background: isActive(item.path) ? 'var(--surface-2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: block !important;
          }
          nav > div > div:first-of-type > div:nth-of-type(2) {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}

