import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Section: React.FC<{ id?: string; children: React.ReactNode; style?: React.CSSProperties }>
  = ({ id, children, style }) => (
  <section id={id} className="container" style={{ padding: '72px 0', ...style }}>{children}</section>
);

export const Title: React.FC<{ kicker?: string; title: string; subtitle?: string; center?: boolean }>
  = ({ kicker, title, subtitle, center }) => (
  <div style={{ textAlign: center ? 'center' : 'left', marginBottom: 28 }}>
    {kicker && <div className="kicker">{kicker}</div>}
    <div className="h2" style={{ marginTop: 10 }}>{title}</div>
    {subtitle && <p className="p" style={{ marginTop: 10 }}>{subtitle}</p>}
  </div>
);

export const Grid: React.FC<{ cols?: number; children: React.ReactNode }>
  = ({ cols = 3, children }) => (
  <div style={{
    display: 'grid', gap: 20,
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
  }}>{children}</div>
);

export const Feature: React.FC<{ icon?: React.ReactNode; title: string; text: string }>
  = ({ icon, title, text }) => (
  <div className="card" style={{ padding: 22 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(91,124,250,0.12)', display: 'grid', placeItems: 'center', color: 'var(--primary-600)', fontWeight: 900 }}>{icon}</div>
      <div style={{ fontWeight: 800 }}>{title}</div>
    </div>
    <div className="small" style={{ marginTop: 10 }}>{text}</div>
  </div>
);

export const Nav: React.FC = () => {
  const { user } = useAuth();
  const getDashboardPath = () => {
    if (!user) return '/dashboard';
    if (user.role === 'client') return '/client';
    if (user.role === 'psychologist' || user.role === 'admin') return '/psychologist';
    if (user.role === 'researcher') return '/researcher';
    if (user.role === 'guest') return '/guest';
    return '/dashboard';
  };
  
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(28,31,43,0.95)', backdropFilter: 'blur(12px)' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ width: 14, height: 14, borderRadius: 9999, background: 'linear-gradient(135deg, var(--primary), var(--accent))' }} />
          <b style={{ fontSize: 18 }}>JungAI</b>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user ? (
            <Link to={getDashboardPath()} className="button" style={{ padding: '10px 20px', textDecoration: 'none' }}>
              Личный кабинет
            </Link>
          ) : (
            <>
              <Link to="/login" className="button secondary" style={{ padding: '10px 20px', textDecoration: 'none' }}>Войти</Link>
              <Link to="/register" className="button" style={{ padding: '10px 20px', textDecoration: 'none' }}>Регистрация</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const Footer: React.FC = () => (
  <div style={{ borderTop: '1px solid rgba(10,16,34,0.08)', marginTop: 40, background: 'var(--surface)' }}>
    <div className="container" style={{ padding: '28px 0', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
      <div>© {new Date().getFullYear()} JungAI</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <a className="small" href="#" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>Политика</a>
        <a className="small" href="#" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>Поддержка</a>
      </div>
    </div>
  </div>
);

export const UserMenu: React.FC<{ user?: { email?: string; role?: string } | null; profile?: { avatarUrl?: string | null; name?: string | null } | null }>
  = ({ user: userProp, profile: profileProp }) => {
  const { user: userFromContext, profile: profileFromContext } = useAuth();
  const user = userProp || userFromContext;
  const profile = profileProp || profileFromContext;
  const [open, setOpen] = React.useState(false);
  const displayName = profile?.name || (user?.email || '').split('@')[0] || 'Пользователь';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const profileLink = user?.role === 'client' ? '/client/profile' : (user?.role === 'psychologist' ? '/psychologist/profile' : (user?.role === 'researcher' ? '/researcher/profile' : '/profile'));
  // Используем тот же базовый URL, что и в api.ts
  const env = (import.meta as any).env || {};
  let baseOrigin: string = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
  if (!baseOrigin && env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '4000') {
    baseOrigin = 'http://localhost:4000';
  }
  // Если baseOrigin пустой, используем текущий origin (для production)
  if (!baseOrigin && typeof window !== 'undefined') {
    baseOrigin = window.location.origin;
  }
  // Формируем правильный URL для аватара
  const avatarSrc = profile?.avatarUrl 
    ? (profile.avatarUrl.startsWith('http') 
        ? profile.avatarUrl 
        : `${baseOrigin}${profile.avatarUrl}`)
    : null;
  
  // Отладочная информация
  if (profile?.avatarUrl) {
    console.log('Avatar URL in profile:', profile.avatarUrl);
    console.log('Base origin:', baseOrigin);
    console.log('Final avatar src:', avatarSrc);
  }
  
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
  };
  
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
        {avatarSrc ? (
          <img 
            key={avatarSrc} // Принудительное обновление при изменении URL
            src={avatarSrc} 
            alt={displayName}
            onError={(e) => {
              console.error('Failed to load avatar image:', avatarSrc);
              // Если изображение не загрузилось, заменяем на инициал
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
              const parent = img.parentElement;
              if (parent && !parent.querySelector('.avatar-fallback')) {
                const fallback = document.createElement('div');
                fallback.className = 'avatar-fallback';
                fallback.style.cssText = 'width: 36px; height: 36px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800;';
                fallback.textContent = initial;
                parent.insertBefore(fallback, img);
              }
            }}
            onLoad={() => {
              console.log('Avatar image loaded successfully:', avatarSrc);
            }}
            style={{ width: 36, height: 36, borderRadius: 999, objectFit: 'cover' }}
          />
        ) : null}
        {!avatarSrc && (
          <div style={{ width: 36, height: 36, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{initial}</div>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', minWidth: 220, background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', padding: 8, zIndex: 2000 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center', padding: 8 }}>
            {avatarSrc ? (
              <img 
                key={avatarSrc} // Принудительное обновление при изменении URL
                src={avatarSrc} 
                alt={displayName}
                onError={(e) => {
                  console.error('Failed to load avatar image in menu:', avatarSrc);
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const parent = img.parentElement;
                  if (parent && !parent.querySelector('.avatar-fallback-menu')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'avatar-fallback-menu';
                    fallback.style.cssText = 'width: 40px; height: 40px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800;';
                    fallback.textContent = initial;
                    parent.insertBefore(fallback, img);
                  }
                }}
                onLoad={() => {
                  console.log('Avatar image loaded successfully in menu:', avatarSrc);
                }}
                style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }}
              />
            ) : null}
            {!avatarSrc && (
              <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{initial}</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div className="small" style={{ color: 'var(--text-muted)' }}>{user?.email || '—'}</div>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />
          <Link to={profileLink} onClick={() => setOpen(false)} style={{ display: 'block', padding: '8px 10px', textDecoration: 'none', color: 'inherit', borderRadius: 8 }}>Профиль</Link>
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px 10px', textAlign: 'left', background: 'transparent', border: 'none', color: 'inherit', borderRadius: 8, cursor: 'pointer' }}>Выйти</button>
        </div>
      )}
    </div>
  );
};