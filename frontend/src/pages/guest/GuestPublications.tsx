import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GuestNavbar } from '../../components/GuestNavbar';
import PublicationsPage from '../publications/Publications';

export default function GuestPublications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const handleShowModal = () => {
      if (!user) {
        setShowRegisterModal(true);
      }
    };
    window.addEventListener('show-register-modal', handleShowModal);
    return () => window.removeEventListener('show-register-modal', handleShowModal);
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GuestNavbar />
      <div style={{ position: 'relative' }}>
        <style>{`
          .guest-publications-wrapper nav {
            display: none !important;
          }
        `}</style>
        <div className="guest-publications-wrapper">
          <PublicationsPage />
        </div>
      </div>

      {/* Register Modal */}
      {showRegisterModal && (
        <div onClick={() => setShowRegisterModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 12, zIndex: 50 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 16 }}>Регистрация необходима</div>
            <p style={{ marginBottom: 24, color: 'var(--text-muted)' }}>
              Для создания публикаций необходимо зарегистрироваться на платформе.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="button secondary" onClick={() => setShowRegisterModal(false)} style={{ padding: '10px 20px' }}>
                Отмена
              </button>
              <button className="button" onClick={() => navigate('/login')} style={{ padding: '10px 20px' }}>
                Войти
              </button>
              <button className="button" onClick={() => navigate('/register')} style={{ padding: '10px 20px' }}>
                Зарегистрироваться
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

