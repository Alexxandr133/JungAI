import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

type IncomingRequest = {
  id: string;
  title: string;
  description: string;
  status: string;
  adminResponse?: string | null;
  createdAt: string;
  client?: { id: string; name: string; email: string | null } | null;
};

export default function PsychologistRequestsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [declineTarget, setDeclineTarget] = useState<IncomingRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [submittingDecline, setSubmittingDecline] = useState(false);

  useEffect(() => {
    load();
  }, [token]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ items: IncomingRequest[] }>('/api/psychologist/requests', { token });
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function startChat(requestId: string) {
    if (!token) return;
    const res = await api<{ roomId: string }>(`/api/psychologist/requests/${requestId}/start-chat`, {
      method: 'POST',
      token
    });
    if (res.roomId) navigate(`/chat?roomId=${encodeURIComponent(res.roomId)}`);
  }

  async function attachClient(requestId: string) {
    if (!token) return;
    await api(`/api/psychologist/requests/${requestId}/respond`, {
      method: 'POST',
      token,
      body: { action: 'accept' }
    });
    await load();
  }

  async function decline(requestId: string, reason: string) {
    if (!token) return;
    const updated = await api<IncomingRequest>(`/api/psychologist/requests/${requestId}/respond`, {
      method: 'POST',
      token,
      body: { action: 'decline', declineReason: reason }
    });
    setItems(prev => prev.map(item => item.id === requestId ? { ...item, ...updated } : item));
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <h1 style={{ marginTop: 0 }}>Запросы клиентов</h1>
        <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          Все запросы на чат и консультации с контактами клиента.
        </div>

        {loading ? <div className="card" style={{ padding: 16 }}>Загрузка...</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((r) => (
              <div key={r.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</b>
                    <span
                      className="small"
                      style={{
                        borderRadius: 999,
                        padding: '2px 8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: r.status === 'declined' ? '#fca5a5' : r.status === 'resolved' ? '#86efac' : 'var(--text-muted)',
                        background: r.status === 'declined'
                          ? 'rgba(239,68,68,0.14)'
                          : r.status === 'resolved'
                            ? 'rgba(34,197,94,0.14)'
                            : 'transparent'
                      }}
                    >
                      {r.status === 'declined' ? 'Отклонен' : r.status === 'resolved' ? 'Принят' : 'Новый'}
                    </span>
                  </div>
                  <span className="small" style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                {r.client ? (
                  <div className="small" style={{ marginBottom: 8 }}>
                    Клиент: <b>{r.client.name}</b> {r.client.email ? `(${r.client.email})` : ''}
                  </div>
                ) : null}
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 10 }}>{r.description}</div>
                {r.adminResponse ? (
                  <div
                    className="small"
                    style={{
                      marginBottom: 10,
                      borderRadius: 10,
                      padding: '8px 10px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(148,163,184,0.08)'
                    }}
                  >
                    {r.adminResponse}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="button secondary" onClick={() => startChat(r.id)} disabled={r.status !== 'open'}>Начать чат</button>
                  <button className="button" onClick={() => attachClient(r.id)} disabled={r.status !== 'open'}>Начать ведение клиента</button>
                  <button
                    className="button secondary"
                    disabled={r.status !== 'open'}
                    onClick={() => {
                      setDeclineTarget(r);
                      setDeclineReason('');
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 ? <div className="card" style={{ padding: 20 }}>Пока нет входящих запросов.</div> : null}
          </div>
        )}
      </main>

      {declineTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 2200,
            padding: 16
          }}
          onClick={() => {
            if (!submittingDecline) setDeclineTarget(null);
          }}
        >
          <div
            className="card"
            style={{ width: 'min(560px, 96vw)', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Причина отклонения</h3>
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              Причина будет отправлена клиенту сообщением в чат по этой заявке.
            </div>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Например: Сейчас нет свободных слотов, пожалуйста выберите другое время или другого специалиста."
              style={{
                width: '100%',
                minHeight: 120,
                borderRadius: 10,
                border: '1px solid var(--navbar-edge)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14,
                padding: 12,
                resize: 'vertical',
                marginBottom: 12
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="button secondary"
                disabled={submittingDecline}
                onClick={() => setDeclineTarget(null)}
              >
                Отмена
              </button>
              <button
                className="button"
                disabled={submittingDecline || declineReason.trim().length < 5}
                onClick={async () => {
                  if (!declineTarget) return;
                  try {
                    setSubmittingDecline(true);
                    await decline(declineTarget.id, declineReason.trim());
                    setDeclineTarget(null);
                    setDeclineReason('');
                  } finally {
                    setSubmittingDecline(false);
                  }
                }}
              >
                {submittingDecline ? 'Сохранение...' : 'Отклонить запрос'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
