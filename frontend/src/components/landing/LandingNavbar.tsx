import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';
import { useAuth } from '../../context/AuthContext';

const AUDIENCE_LINKS = [
  { label: 'Для психологов', to: '/' },
  { label: 'Для клиентов', to: '/for-clients' },
  { label: 'Для исследователей', to: '/for-researchers' },
] as const;

const COMMUNITY_LINK = { label: 'Сообщество', to: '/communities' } as const;

type LandingNavbarProps = {
  variant?: 'default' | 'psychologist' | 'client' | 'catalog' | 'researcher';
};

function isAudienceActive(pathname: string, to: string) {
  if (to === '/') {
    return pathname === '/' || pathname.startsWith('/for-psychologists');
  }
  return pathname.startsWith(to);
}

function cabinetPathForRole(role: string | undefined) {
  switch (role) {
    case 'client':
      return '/client';
    case 'admin':
      return '/admin';
    case 'psychologist':
      return '/psychologist';
    case 'researcher':
      return '/researcher';
    case 'guest':
      return '/guest';
    default:
      return '/dashboard';
  }
}

export function LandingNavbar({ variant = 'default' }: LandingNavbarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const cabinetPath = cabinetPathForRole(user?.role);

  const isClient = variant === 'client';
  const isCatalog = variant === 'catalog';
  const isResearcher = variant === 'researcher';
  const psychActive = location.pathname.startsWith('/psychologists');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`landing-nav${scrolled ? ' landing-nav--scrolled' : ''}`}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--paper)',
        borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
        transition: 'border-color 0.2s ease',
      }}
    >
      <div
        className="landing-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          height: 68,
        }}
      >
        <BrandLogo to="/" height={44} />

        {isCatalog ? (
          <nav
            className="landing-nav__anchors"
            aria-label="Разделы"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flex: 1,
              justifyContent: 'center',
              minWidth: 0,
            }}
          >
            <Link
              to="/psychologists"
              className="landing-small"
              style={{
                padding: '8px 10px',
                textDecoration: 'none',
                color: psychActive ? 'var(--brand)' : 'var(--ink-soft)',
                fontWeight: psychActive ? 700 : 500,
                whiteSpace: 'nowrap',
                borderRadius: 8,
              }}
            >
              Психологи
            </Link>
            <Link
              to="/match"
              className="landing-small"
              style={{
                padding: '8px 10px',
                textDecoration: 'none',
                color: location.pathname.startsWith('/match') ? 'var(--brand)' : 'var(--ink-soft)',
                fontWeight: location.pathname.startsWith('/match') ? 700 : 500,
                whiteSpace: 'nowrap',
                borderRadius: 8,
              }}
            >
              Подбор
            </Link>
            <Link
              to="/for-clients"
              className="landing-small"
              style={{
                padding: '8px 10px',
                textDecoration: 'none',
                color: 'var(--ink-soft)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                borderRadius: 8,
              }}
            >
              О сервисе
            </Link>
          </nav>
        ) : (
          <nav
            className="landing-nav__anchors"
            aria-label="Аудитории"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: 1,
              justifyContent: 'flex-start',
              minWidth: 0,
              marginLeft: 12,
              paddingRight: 8,
            }}
          >
            {AUDIENCE_LINKS.map((item) => {
              const active = isAudienceActive(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`landing-btn${active ? ' landing-btn--secondary' : ' landing-btn--ghost'}`}
                  style={{
                    padding: '8px 12px',
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    whiteSpace: 'nowrap',
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to={COMMUNITY_LINK.to}
              className={`landing-btn${
                location.pathname.startsWith('/communities') || location.pathname.startsWith('/publications')
                  ? ' landing-btn--secondary'
                  : ' landing-btn--ghost'
              }`}
              style={{
                padding: '8px 12px',
                fontSize: 14,
                fontWeight:
                  location.pathname.startsWith('/communities') || location.pathname.startsWith('/publications')
                    ? 600
                    : 500,
                whiteSpace: 'nowrap',
              }}
              aria-current={
                location.pathname.startsWith('/communities') || location.pathname.startsWith('/publications')
                  ? 'page'
                  : undefined
              }
            >
              {COMMUNITY_LINK.label}
            </Link>
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {user ? (
            <Link to={cabinetPath} className="landing-btn landing-btn--ghost landing-nav__desktop-cta">
              Личный кабинет
            </Link>
          ) : (
            <Link to="/login" className="landing-btn landing-btn--ghost landing-nav__desktop-cta">
              Войти
            </Link>
          )}
          {isClient || isCatalog ? (
            <Link to="/match" className="landing-btn landing-btn--primary landing-nav__desktop-cta">
              Выбрать психолога
            </Link>
          ) : isResearcher ? (
            <Link
              to="/register?role=researcher"
              className="landing-btn landing-btn--primary landing-nav__desktop-cta"
            >
              Начать исследование
            </Link>
          ) : (
            <Link to="/register" className="landing-btn landing-btn--primary landing-nav__desktop-cta">
              Попробовать бесплатно
            </Link>
          )}
          <button
            type="button"
            className="landing-nav__burger"
            aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMobileOpen((v) => !v)}
            style={{
              display: 'none',
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--card)',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {mobileOpen ? '×' : '☰'}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          style={{
            borderTop: '1px solid var(--line)',
            background: 'var(--paper)',
            padding: '12px 16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {isCatalog ? (
            <>
              <Link
                to="/psychologists"
                onClick={() => setMobileOpen(false)}
                style={{
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: psychActive ? 'var(--brand)' : 'var(--ink)',
                  fontWeight: 600,
                  borderRadius: 10,
                }}
              >
                Психологи
              </Link>
              <Link
                to="/match"
                onClick={() => setMobileOpen(false)}
                style={{
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: 'var(--ink)',
                  fontWeight: 600,
                  borderRadius: 10,
                }}
              >
                Подбор
              </Link>
              <Link
                to="/for-clients"
                onClick={() => setMobileOpen(false)}
                style={{
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: 'var(--ink)',
                  fontWeight: 600,
                  borderRadius: 10,
                }}
              >
                О сервисе
              </Link>
            </>
          ) : (
            AUDIENCE_LINKS.map((item) => {
              const active = isAudienceActive(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`landing-btn${active ? ' landing-btn--secondary' : ' landing-btn--ghost'}`}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })
          )}
          {!isCatalog && (
            <Link
              to={COMMUNITY_LINK.to}
              className={`landing-btn${
                location.pathname.startsWith('/communities') || location.pathname.startsWith('/publications')
                  ? ' landing-btn--secondary'
                  : ' landing-btn--ghost'
              }`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => setMobileOpen(false)}
            >
              {COMMUNITY_LINK.label}
            </Link>
          )}
          {user ? (
            <Link
              to={cabinetPath}
              className="landing-btn landing-btn--secondary"
              style={{ width: '100%' }}
              onClick={() => setMobileOpen(false)}
            >
              Личный кабинет
            </Link>
          ) : (
            <Link
              to="/login"
              className="landing-btn landing-btn--secondary"
              style={{ width: '100%' }}
              onClick={() => setMobileOpen(false)}
            >
              Войти
            </Link>
          )}
          {isClient || isCatalog ? (
            <Link
              to="/match"
              className="landing-btn landing-btn--primary"
              style={{ width: '100%' }}
              onClick={() => setMobileOpen(false)}
            >
              Выбрать психолога
            </Link>
          ) : isResearcher ? (
            <Link
              to="/register?role=researcher"
              className="landing-btn landing-btn--primary"
              style={{ width: '100%' }}
              onClick={() => setMobileOpen(false)}
            >
              Начать исследование
            </Link>
          ) : (
            <Link
              to="/register"
              className="landing-btn landing-btn--primary"
              style={{ width: '100%' }}
              onClick={() => setMobileOpen(false)}
            >
              Попробовать бесплатно
            </Link>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 960px) {
          .landing-nav__anchors { display: none !important; }
          .landing-nav__desktop-cta { display: none !important; }
          .landing-nav__burger { display: inline-flex !important; align-items: center; justify-content: center; }
        }
      `}</style>
    </header>
  );
}
