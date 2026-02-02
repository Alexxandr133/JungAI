import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Автоматический редирект на соответствующие дашборды
  useEffect(() => {
    if (user?.role === 'client') {
      navigate('/client', { replace: true });
    } else if (user?.role === 'psychologist' || user?.role === 'admin') {
      navigate('/psychologist', { replace: true });
    } else if (user?.role === 'researcher') {
      navigate('/researcher', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Дашборд</h2>
      <div>Вы вошли как: <b>{user?.email}</b> (роль: {user?.role})</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Link to="/dreams">Дневник снов</Link>
        <Link to="/dreams/new">Новая запись сна</Link>
      </div>
      <button style={{ marginTop: 16 }} onClick={logout}>Выйти</button>
    </div>
  );
}
