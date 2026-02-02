import { useAuth } from '../../context/AuthContext';
import { GuestNavbar } from '../../components/GuestNavbar';
import DreamsList from '../dreams/List';

export default function GuestDreams() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GuestNavbar />
      <div style={{ position: 'relative' }}>
        <style>{`
          .guest-dreams-wrapper nav {
            display: none !important;
          }
        `}</style>
        <div className="guest-dreams-wrapper">
          {!user && (
            <div className="card" style={{ padding: 20, margin: '24px 48px', background: 'linear-gradient(135deg, var(--primary)22, var(--accent)11)', border: '1px solid var(--primary)' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 Вы можете записывать сны как гость</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Ваши сны будут сохранены локально. Для синхронизации и доступа с других устройств зарегистрируйтесь.
                </div>
              </div>
            </div>
          )}
          <DreamsList />
        </div>
      </div>
    </div>
  );
}

