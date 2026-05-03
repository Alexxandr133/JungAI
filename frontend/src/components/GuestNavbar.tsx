import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { ThemeMenuButton } from './ThemeMenuButton';
import { PlatformIcon, type PlatformIconName } from './icons';

type MenuItem = {
  label: string;
  path?: string;
  icon?: PlatformIconName;
  children?: Array<{ label: string; path: string; icon?: PlatformIconName }>;
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
      icon: 'home'
    },
    {
      label: 'Психологи',
      path: '/psychologists',
      icon: 'stethoscope'
    },
    {
      label: 'Тесты',
      path: '/guest/tests',
      icon: 'chart'
    },
    {
      label: 'Публикации',
      path: '/guest/publications',
      icon: 'library'
    },
    {
      label: 'Мои сны',
      path: '/guest/dreams',
      icon: 'dreams'
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
        zIndex: 10000,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--navbar-edge)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
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
            minWidth: 0
          }}
        >
          <div className="guest-navbar-logo" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <BrandLogo to="/" />
          </div>

          {/* Desktop Menu */}
          <div
            className="guest-desktop-menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: 1,
              minWidth: 0,
              justifyContent: 'center'
            }}
          >
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
                        padding: '8px 12px',
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
                      {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
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
                            {child.icon && <PlatformIcon name={child.icon} size={16} style={{ flexShrink: 0, opacity: 0.9 }} />}
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
                    padding: '8px 12px',
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
                  {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div
            className="navbar-right-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              marginLeft: 'auto',
              zIndex: 2,
              position: 'relative'
            }}
          >
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
                style={{ padding: '8px 14px', fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                Личный кабинет
              </Link>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
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
                  Регистрация
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
                fontSize: 20
              }}
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            >
              <span style={{ fontSize: 22, lineHeight: 1, fontWeight: 700 }}>
                {mobileMenuOpen ? '×' : '☰'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Menu - rendered via Portal */}
        {mobileMenuOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="mobile-menu"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(5,8,16,0.8)',
              backdropFilter: 'blur(6px)',
              zIndex: 99999,
              display: 'flex',
              justifyContent: 'flex-end'
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
                overflowY: 'auto'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 10px', borderBottom: '1px solid var(--navbar-edge)', marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Меню</div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 24,
                    lineHeight: 1,
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title="Закрыть"
                >
                  ×
                </button>
              </div>
              <div style={{ padding: '8px 0 12px', borderBottom: '1px solid var(--navbar-edge)' }}>
                <ThemeMenuButton compact={false} />
              </div>
              {menuItems.map((item) => (
                <Link
                  key={item.path || item.label}
                  to={item.path || '#'}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
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
                  {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .mobile-menu-button {
            display: flex !important;
          }
          .guest-desktop-menu {
            display: none !important;
          }
          .guest-navbar-logo img {
            height: 44px !important;
          }
          .guest-navbar-logo .brand-logo-text {
            font-size: 15px !important;
          }
          .guest-navbar-logo .brand-logo-link {
            gap: 8px !important;
          }
          .navbar-right-actions {
            gap: 8px !important;
            margin-left: auto !important;
            justify-content: flex-end !important;
            flex-shrink: 0;
          }
          .mobile-menu-button {
            width: 36px !important;
            height: 36px !important;
            background: var(--surface-2) !important;
            border: 1px solid rgba(148,163,184,0.3) !important;
            color: var(--text) !important;
          }
        }
        @media (max-width: 520px) {
          .guest-navbar-logo .brand-logo-text {
            display: none !important;
          }
          .guest-navbar-logo img {
            height: 40px !important;
          }
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

