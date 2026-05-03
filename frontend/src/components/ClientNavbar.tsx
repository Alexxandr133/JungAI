import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserMenu } from './ui';
import { MessagesBell } from './MessagesBell';
import { BrandLogo } from './BrandLogo';
import { ThemeMenuButton } from './ThemeMenuButton';
import { PlatformIcon, type PlatformIconName } from './icons';

type MenuItem = {
  label: string;
  path?: string;
  icon?: PlatformIconName;
  children?: Array<{ label: string; path: string; icon?: PlatformIconName }>;
};

export function ClientNavbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuItems: MenuItem[] = [
    {
      label: 'Основное',
      icon: 'home',
      children: [
        { label: 'Главная', path: '/client', icon: 'home' },
        { label: 'Мои сны', path: '/dreams', icon: 'dreams' },
        { label: 'Необьяснимое', path: '/paranormal', icon: 'star' },
        { label: 'Дневник', path: '/client/journal', icon: 'journal' },
        { label: 'Сессии', path: '/client/sessions', icon: 'calendar' }
      ]
    },
    {
      label: 'ИИ-помощник',
      path: '/client/ai',
      icon: 'bot'
    },
    {
      label: 'Личное развитие',
      icon: 'sparkles',
      children: [
        { label: 'Баллы и уровень', path: '/client/tasks', icon: 'trophy' },
        { label: 'Тесты', path: '/client/tests', icon: 'chart' }
      ]
    },
    {
      label: 'Сообщество',
      icon: 'users',
      children: [
        { label: 'Сообщения', path: '/chat', icon: 'inbox' }
      ]
    },
    {
      label: 'Мой психолог',
      path: '/client/psychologists',
      icon: 'stethoscope'
    },
    {
      label: 'О платформе',
      path: '/about',
      icon: 'info'
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
    if (path === '/client') {
      return location.pathname === '/client';
    }
    if (path === '/client/ai') {
      return location.pathname === '/client/ai';
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
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--navbar-edge)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{
        maxWidth: '100%',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        gap: 24,
        position: 'relative'
      }}>
        <div className="navbar-mobile-left" style={{ display: 'none' }}>
          <MessagesBell />
        </div>

        <div className="navbar-logo-wrap">
          <BrandLogo to="/client" />
        </div>

        {/* Desktop Menu */}
        <div
          className="navbar-desktop-menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            justifyContent: 'center',
            minWidth: 0
          }}
        >
          {menuItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isHovered = hoveredMenu === item.label;
            const itemIsActive = isActive(item.path) || (hasChildren && item.children?.some(child => isActive(child.path)));

            return (
              <div
                key={item.label}
                style={{ position: 'relative' }}
                onMouseEnter={() => hasChildren && handleMouseEnter(item.label)}
                onMouseLeave={handleMouseLeave}
              >
                {item.path ? (
                  <Link
                    to={item.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      borderRadius: 10,
                      textDecoration: 'none',
                      color: itemIsActive ? 'var(--primary)' : 'var(--text)',
                      background: itemIsActive
                        ? 'rgba(91, 124, 250, 0.12)'
                        : isHovered
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'transparent',
                      fontWeight: itemIsActive ? 600 : 500,
                      fontSize: 14,
                      transition: 'all 0.2s ease',
                      border: itemIsActive ? '1px solid rgba(91, 124, 250, 0.2)' : '1px solid transparent'
                    }}
                  >
                    {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: itemIsActive
                        ? 'rgba(91, 124, 250, 0.12)'
                        : isHovered
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'transparent',
                      color: itemIsActive ? 'var(--primary)' : 'var(--text)',
                      fontWeight: itemIsActive ? 600 : 500,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: itemIsActive ? '1px solid rgba(91, 124, 250, 0.2)' : '1px solid transparent'
                    }}
                  >
                    {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                    <span>{item.label}</span>
                    {hasChildren && (
                      <span style={{
                        marginLeft: 4,
                        fontSize: 10,
                        transition: 'transform 0.2s ease',
                        transform: isHovered ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}>▼</span>
                    )}
                  </button>
                )}

                {/* Dropdown Menu */}
                {hasChildren && isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 8,
                      minWidth: 220,
                      background: 'var(--surface)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 12,
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                      padding: 8,
                      animation: 'fadeIn 0.2s ease',
                      zIndex: 1001
                    }}
                    onMouseEnter={() => handleMouseEnter(item.label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {item.children?.map((child) => {
                      const childIsActive = isActive(child.path);
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 8,
                            textDecoration: 'none',
                            color: childIsActive ? 'var(--primary)' : 'var(--text)',
                            background: childIsActive
                              ? 'rgba(91, 124, 250, 0.12)'
                              : 'transparent',
                            fontWeight: childIsActive ? 600 : 500,
                            fontSize: 14,
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                            if (!childIsActive) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }
                          }}
                          onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                            if (!childIsActive) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          {child.icon && <PlatformIcon name={child.icon} size={16} style={{ flexShrink: 0, opacity: 0.9 }} />}
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Side Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
          className="navbar-right-actions"
        >
          <div className="navbar-desktop-icons" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MessagesBell />
          </div>
          <div className="mobile-user-menu">
            <UserMenu user={user as any} includeMobileMessagesItem />
          </div>
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
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5,8,16,0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          className="mobile-menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            style={{
              width: '80%',
              maxWidth: 320,
              background: 'var(--surface)',
              padding: '12px 16px',
              borderLeft: '1px solid var(--navbar-edge)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
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
              <div key={item.label}>
                {item.path ? (
                  <Link
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: isActive(item.path) ? 'var(--primary)' : 'var(--text)',
                      background: isActive(item.path) ? 'rgba(91, 124, 250, 0.12)' : 'transparent',
                      fontWeight: isActive(item.path) ? 600 : 500,
                      fontSize: 14
                    }}
                  >
                    {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      fontWeight: 500,
                      fontSize: 14
                    }}>
                      {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                      <span>{item.label}</span>
                    </div>
                    {item.children && (
                      <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setMobileMenuOpen(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              borderRadius: 6,
                              textDecoration: 'none',
                              color: isActive(child.path) ? 'var(--primary)' : 'var(--text-muted)',
                              fontWeight: isActive(child.path) ? 600 : 500,
                              fontSize: 13
                            }}
                          >
                            {child.icon && <PlatformIcon name={child.icon} size={16} style={{ flexShrink: 0, opacity: 0.9 }} />}
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 1024px) {
          .mobile-menu-button {
            display: flex !important;
          }
          .navbar-desktop-menu {
            display: none !important;
          }
          .navbar-desktop-icons {
            display: none !important;
          }
          .navbar-mobile-left {
            display: flex !important;
            align-items: center;
            width: 40px;
            min-width: 40px;
            z-index: 2;
            position: relative;
          }
          .navbar-logo-wrap {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            z-index: 0;
            pointer-events: none;
            background: var(--surface);
            border-radius: 0 0 18px 18px;
            padding: 0 10px 0;
            box-shadow: 0 6px 18px rgba(2, 6, 23, 0.28);
            border-left: 1px solid rgba(148,163,184,0.2);
            border-right: 1px solid rgba(148,163,184,0.2);
            border-bottom: 1px solid rgba(148,163,184,0.2);
          }
          .navbar-logo-wrap .brand-logo-link {
            pointer-events: auto;
          }
          .navbar-logo-wrap .brand-logo-text {
            display: none !important;
          }
          .navbar-logo-wrap img {
            height: 64px !important;
          }
          .navbar-right-actions {
            gap: 8px !important;
            z-index: 2;
            position: relative;
            margin-left: auto;
            justify-content: flex-end;
          }
          .mobile-user-menu img {
            width: 30px !important;
            height: 30px !important;
          }
          .mobile-user-menu > div > button > div {
            width: 30px !important;
            height: 30px !important;
            font-size: 12px !important;
          }
          .mobile-menu-button {
            width: 36px !important;
            height: 36px !important;
            background: var(--surface-2) !important;
            border: 1px solid rgba(148,163,184,0.3) !important;
            color: var(--text) !important;
          }
        }
      `}</style>
    </nav>
  );
}

