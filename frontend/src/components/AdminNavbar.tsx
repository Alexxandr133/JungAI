import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserMenu } from './ui';
import { NotificationsBell } from './NotificationsBell';
import { BrandLogo } from './BrandLogo';
import { ThemeMenuButton } from './ThemeMenuButton';
import { PlatformIcon, type PlatformIconName } from './icons';

type MenuItem = {
  label: string;
  path?: string;
  icon?: PlatformIconName;
  children?: Array<{ label: string; path: string; icon?: PlatformIconName }>;
};

export function AdminNavbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuItems: MenuItem[] = [
    {
      label: 'Главная',
      path: '/admin',
      icon: 'dashboard',
    },
    {
      label: 'Люди',
      icon: 'users',
      children: [
        { label: 'Пользователи', path: '/admin/users', icon: 'user' },
        { label: 'Каталог психологов', path: '/admin/psychologists-catalog', icon: 'users' },
        { label: 'Верификация', path: '/admin/verification', icon: 'check' },
      ],
    },
    {
      label: 'Операции',
      icon: 'wrench',
      children: [
        { label: 'Тех. запросы', path: '/admin/support', icon: 'wrench' },
        { label: 'Открытый функционал', path: '/admin/open-access', icon: 'unlock' },
      ],
    },
    {
      label: 'Коммуникации',
      icon: 'mail',
      children: [{ label: 'Рассылки', path: '/admin/mailings', icon: 'mail' }],
    },
    {
      label: 'Аналитика',
      path: '/admin/analytics',
      icon: 'lineChart',
    },
    {
      label: 'О платформе',
      path: '/about',
      icon: 'info',
    },
  ];

  const handleMouseEnter = (label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHoveredMenu(label);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setHoveredMenu(null), 150);
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div
        style={{
          maxWidth: '100%',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
          gap: 24,
        }}
      >
        <BrandLogo to="/admin" />

        <div
          className="navbar-desktop-menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {menuItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isHovered = hoveredMenu === item.label;
            const itemIsActive =
              isActive(item.path) || (hasChildren && item.children?.some((child) => isActive(child.path)));

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
                      whiteSpace: 'nowrap',
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
                      border: itemIsActive ? '1px solid rgba(91, 124, 250, 0.2)' : '1px solid transparent',
                    }}
                  >
                    {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                    <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 16px',
                      whiteSpace: 'nowrap',
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
                      border: itemIsActive ? '1px solid rgba(91, 124, 250, 0.2)' : '1px solid transparent',
                    }}
                  >
                    {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                    <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                    {hasChildren && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 10,
                          transition: 'transform 0.2s ease',
                          transform: isHovered ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        ▼
                      </span>
                    )}
                  </button>
                )}

                {hasChildren && isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 8,
                      minWidth: 240,
                      background: 'var(--surface)',
                      border: '1px solid var(--navbar-edge)',
                      borderRadius: 12,
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
                      padding: 8,
                      zIndex: 1001,
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
                            background: childIsActive ? 'rgba(91, 124, 250, 0.12)' : 'transparent',
                            fontWeight: childIsActive ? 600 : 500,
                            fontSize: 14,
                          }}
                        >
                          {child.icon && (
                            <PlatformIcon name={child.icon} size={16} style={{ flexShrink: 0, opacity: 0.9 }} />
                          )}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeMenuButton />
          <NotificationsBell />
          <UserMenu user={user as any} />
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
            fontSize: 20,
          }}
          className="mobile-menu-button"
        >
          <PlatformIcon name={mobileMenuOpen ? 'close' : 'menu'} size={22} />
        </button>
      </div>

      {mobileMenuOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
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
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onClick={(e) => e.stopPropagation()}
            >
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
                        fontSize: 14,
                      }}
                    >
                      {item.icon && <PlatformIcon name={item.icon} size={18} style={{ flexShrink: 0, opacity: 0.9 }} />}
                      <span>{item.label}</span>
                    </Link>
                  ) : (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          fontWeight: 500,
                          fontSize: 14,
                        }}
                      >
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
                                fontSize: 13,
                              }}
                            >
                              {child.icon && (
                                <PlatformIcon name={child.icon} size={16} style={{ flexShrink: 0, opacity: 0.9 }} />
                              )}
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
        @media (max-width: 1024px) {
          .mobile-menu-button { display: flex !important; }
          .navbar-desktop-menu { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
