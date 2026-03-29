import { Link } from 'react-router-dom';
import { ThemeMenuButton } from '../../components/ThemeMenuButton';

export default function GuestPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeMenuButton />
      </div>
      <div className="card" style={{ maxWidth: 600, padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>👋</div>
        <h1 style={{ margin: 0, marginBottom: 16, fontSize: 32, fontWeight: 800 }}>
          Добро пожаловать, гость!
        </h1>
        <p style={{ margin: 0, marginBottom: 32, color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6 }}>
          Вы вошли как гость. Для полного доступа к функциям платформы необходимо зарегистрироваться 
          или войти в систему.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="button" style={{ padding: '12px 24px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            Зарегистрироваться
          </Link>
          <Link to="/login" className="button secondary" style={{ padding: '12px 24px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
