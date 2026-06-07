import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function SessionExpiredModal() {
  const { token, sessionExpired, logout } = useAuth();
  const navigate = useNavigate();

  if (!sessionExpired || !token) return null;

  function handleRelogin() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,8,16,0.82)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 5000,
      }}
    >
      <div className="card" style={{ width: 'min(520px, 94vw)', padding: 24, borderRadius: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Сессия истекла</h3>
        <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.55 }}>
          Время авторизации закончилось. Войдите снова, чтобы продолжить работу. Это не связано с верификацией аккаунта.
        </div>
        <button type="button" className="button" onClick={handleRelogin} style={{ width: '100%' }}>
          Войти снова
        </button>
      </div>
    </div>
  );
}
