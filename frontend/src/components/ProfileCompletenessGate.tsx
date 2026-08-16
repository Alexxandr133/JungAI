import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

type Completeness = {
  complete: boolean;
  missing: Array<{ key: string; label: string }>;
};

const SESSION_KEY = 'jungai_profile_complete_dismissed';

/** Показывает модалку при входе, если не заполнены ключевые поля каталога/подбора. */
export function ProfileCompletenessGate() {
  const { token, user } = useAuth();
  const [data, setData] = useState<Completeness | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token || (user?.role !== 'psychologist' && user?.role !== 'admin')) return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    api<Completeness>('/api/psychologist/profile/completeness', { token })
      .then((res: Completeness) => {
        setData(res);
        if (!res.complete && res.missing?.length) setOpen(true);
      })
      .catch(() => undefined);
  }, [token, user?.role]);

  if (!open || !data || data.complete) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 2400,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
      onClick={() => {
        sessionStorage.setItem(SESSION_KEY, '1');
        setOpen(false);
      }}
    >
      <div
        className="card"
        style={{ width: 'min(480px, 96vw)', padding: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Дополните профиль</h2>
        <p style={{ marginTop: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Чтобы попадать в умный подбор клиентов, заполните недостающие поля — включая образование с годами.
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, lineHeight: 1.6 }}>
          {data.missing.map((m) => (
            <li key={m.key}>{m.label}</li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              sessionStorage.setItem(SESSION_KEY, '1');
              setOpen(false);
            }}
          >
            Позже
          </button>
          <Link
            to="/psychologist/profile"
            className="button"
            onClick={() => {
              sessionStorage.setItem(SESSION_KEY, '1');
              setOpen(false);
            }}
          >
            Заполнить профиль
          </Link>
        </div>
      </div>
    </div>
  );
}
