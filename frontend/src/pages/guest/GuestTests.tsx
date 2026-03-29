import { useAuth } from '../../context/AuthContext';
import { GuestNavbar } from '../../components/GuestNavbar';
import ClientTests from '../client/Tests';

export default function GuestTests() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GuestNavbar />
      <div style={{ position: 'relative' }}>
        <style>{`
          .guest-tests-wrapper nav {
            display: none !important;
          }
        `}</style>
        <div className="guest-tests-wrapper">
          {!user && (
            <div className="card" style={{ padding: 20, margin: '24px 48px', background: 'linear-gradient(135deg, var(--primary)22, var(--accent)11)', border: '1px solid var(--primary)' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 Вы можете проходить тесты как гость</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Результаты тестов не будут сохранены. Для сохранения результатов и отслеживания прогресса зарегистрируйтесь.
                </div>
              </div>
            </div>
          )}
          <ClientTests persistResults={false} />
        </div>
      </div>
    </div>
  );
}

