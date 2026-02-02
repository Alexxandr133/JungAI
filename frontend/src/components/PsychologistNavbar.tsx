import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserMenu } from './ui';
import { NotificationsBell } from './NotificationsBell';
import { MessagesBell } from './MessagesBell';

type MenuItem = {
  label: string;
  path?: string;
  icon?: string;
  children?: Array<{ label: string; path: string; icon?: string }>;
};

export function PsychologistNavbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuItems: MenuItem[] = user?.role === 'admin' 
    ? [
        {
          label: 'Администрирование',
          icon: '⚙️',
          children: [
            { label: 'Дашборд', path: '/admin', icon: '📊' },
            { label: 'Верификация', path: '/admin/verification', icon: '✓' },
            { label: 'Тех. запросы', path: '/admin/support', icon: '🔧' },
            { label: 'Открытый функционал', path: '/admin/open-access', icon: '🔓' },
          ]
        }
      ]
    : [
        {
          label: 'Основное',
          icon: '📊',
          children: [
            { label: 'Дашборд', path: '/psychologist', icon: '📊' },
            { label: 'Клиенты', path: '/clients', icon: '👥' },
            { label: 'Сессии', path: '/events', icon: '📅' },
            { label: 'Сообщения', path: '/chat', icon: '💬' },
          ]
        },
        {
          label: 'Инструменты',
          icon: '🛠️',
          children: [
            { label: 'Рабочая область', path: '/psychologist/work-area', icon: '💼' },
            { label: 'Журнал снов', path: '/dreams', icon: '💭' },
            { label: 'Библиотека', path: '/materials', icon: '📚' },
          ]
        },
        {
          label: 'AI Ассистент',
          path: '/psychologist/ai',
          icon: '🤖'
        },
        {
          label: 'Исследования',
          icon: '🔬',
          children: [
            { label: 'Амплификации', path: '/research/amplifications', icon: '🔮' },
          ]
        },
        {
          label: 'Публикации',
          path: '/publications',
          icon: '📖'
        },
        {
          label: 'Тех.поддержка',
          path: '/psychologist/support',
          icon: '🔧'
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
    if (path === '/psychologist') {
      return location.pathname === '/psychologist';
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
        zIndex: 1000,
        background: 'rgba(28, 31, 43, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
        gap: 24
      }}>
        {/* Logo */}
        <Link
          to="/psychologist"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: 700,
            fontSize: 18
          }}
        >
          <div style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            background: 'linear-gradient(135deg, var(--primary), var(--accent))'
          }} />
          <span>JungAI</span>
        </Link>

        {/* Desktop Menu */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          justifyContent: 'center'
        }}>
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
                    {item.icon && <span>{item.icon}</span>}
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
                    {item.icon && <span>{item.icon}</span>}
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
                          onMouseEnter={(e) => {
                            if (!childIsActive) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!childIsActive) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          {child.icon && <span style={{ fontSize: 16 }}>{child.icon}</span>}
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <MessagesBell />
          <NotificationsBell />
          <UserMenu user={user as any} />
        </div>

        {/* Mobile Menu Button */}
        <button
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
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        style={{
          display: mobileMenuOpen ? 'block' : 'none',
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'var(--surface)'
        }}
        className="mobile-menu"
      >
        <div style={{ display: 'grid', gap: 8 }}>
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
                    padding: '12px 16px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: isActive(item.path) ? 'var(--primary)' : 'var(--text)',
                    background: isActive(item.path) ? 'rgba(91, 124, 250, 0.12)' : 'transparent',
                    fontWeight: isActive(item.path) ? 600 : 500
                  }}
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 10,
                    fontWeight: 500
                  }}>
                    {item.icon && <span>{item.icon}</span>}
                    <span>{item.label}</span>
                  </div>
                  {item.children && (
                    <div style={{ paddingLeft: 24, display: 'grid', gap: 4 }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setMobileMenuOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 16px',
                            borderRadius: 8,
                            textDecoration: 'none',
                            color: isActive(child.path) ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: isActive(child.path) ? 600 : 500,
                            fontSize: 14
                          }}
                        >
                          {child.icon && <span>{child.icon}</span>}
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
      </div>

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
          nav > div > div:nth-child(2) {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}

