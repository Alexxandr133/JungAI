import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { Link } from 'react-router-dom';

type SupportRequest = {
  id: string;
  title: string;
  description: string;
  allowWorkAreaAccess: boolean;
  clientId: string | null;
  client?: { id: string; name: string; email: string | null } | null;
  psychologistId: string;
  psychologistEmail: string | null;
  psychologistName: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  adminResponse: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
};

export default function AdminSupport() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('resolved');
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadRequests();
    }
  }, [token]);

  async function loadRequests() {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api<{ items: SupportRequest[] }>('/api/admin/support/requests', { token });
      setRequests(res.items || []);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить запросы');
    } finally {
      setLoading(false);
    }
  }

  async function respondToRequest() {
    if (!token || !selectedRequest || !response.trim()) return;
    
    setResponding(true);
    setError(null);
    try {
      await api(`/api/admin/support/requests/${selectedRequest.id}/respond`, {
        method: 'POST',
        token,
        body: {
          adminResponse: response.trim(),
          status
        }
      });
      setResponse('');
      setSelectedRequest(null);
      await loadRequests();
    } catch (e: any) {
      setError(e.message || 'Не удалось ответить на запрос');
    } finally {
      setResponding(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      open: { background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
      in_progress: { background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107' },
      resolved: { background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
      closed: { background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' }
    };
    const labels = {
      open: 'Открыт',
      in_progress: 'В работе',
      resolved: 'Решен',
      closed: 'Закрыт'
    };
    const style = styles[status as keyof typeof styles] || styles.open;
    const label = labels[status as keyof typeof labels] || status;
    return (
      <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, ...style }}>
        {label}
      </span>
    );
  };

  const openAccessCount = requests.filter(r => r.allowWorkAreaAccess && ['open', 'in_progress'].includes(r.status)).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Тех. запросы</h1>
            <div className="small" style={{ color: 'var(--text-muted)' }}>Управление запросами в техподдержку</div>
          </div>
          {openAccessCount > 0 && (
            <Link to="/admin/open-access" className="button" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔓</span>
              <span>Открытый функционал ({openAccessCount})</span>
            </Link>
          )}
        </div>

        {error && (
          <div className="card" style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 20, borderRadius: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : requests.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Нет запросов</div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>Запросы в техподдержку появятся здесь</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {requests.map(req => (
              <div key={req.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{req.title}</h3>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                      От: {req.psychologistName || req.psychologistEmail || 'Психолог'} • {new Date(req.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {req.allowWorkAreaAccess && req.client && (
                      <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, marginBottom: 12 }}>
                        <div className="small" style={{ color: '#3b82f6', fontWeight: 600 }}>
                          🔓 Запрошен доступ к рабочей области: {req.client.name}
                          {['open', 'in_progress'].includes(req.status) && (
                            <Link
                              to={`/admin/open-access?request=${req.id}&client=${req.client.id}`}
                              style={{ marginLeft: 8, textDecoration: 'underline' }}
                            >
                              Открыть доступ
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {!req.adminResponse && (
                    <button
                      className="button"
                      onClick={() => setSelectedRequest(req)}
                      style={{ padding: '8px 16px', fontSize: 14 }}
                    >
                      Ответить
                    </button>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Описание:</div>
                  <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.description}</div>
                </div>
                {req.adminResponse && (
                  <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                      Ответ администратора {req.respondedAt && `(${new Date(req.respondedAt).toLocaleString('ru-RU')})`}:
                    </div>
                    <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.adminResponse}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal для ответа */}
        {selectedRequest && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(5,8,16,0.75)',
              backdropFilter: 'blur(6px)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1000,
              padding: 16
            }}
            onClick={() => setSelectedRequest(null)}
          >
            <div
              className="card"
              style={{
                width: 'min(720px, 94vw)',
                padding: 24,
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                borderRadius: 16
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Ответить на запрос</h2>
                <button
                  className="button secondary"
                  onClick={() => setSelectedRequest(null)}
                  style={{ padding: '6px 10px', fontSize: 13 }}
                >
                  Закрыть
                </button>
              </div>
              <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface-2)', borderRadius: 12 }}>
                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Запрос:</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedRequest.title}</div>
                <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{selectedRequest.description}</div>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>
                    Статус
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontSize: 14
                    }}
                  >
                    <option value="open">Открыт</option>
                    <option value="in_progress">В работе</option>
                    <option value="resolved">Решен</option>
                    <option value="closed">Закрыт</option>
                  </select>
                </div>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>
                    Ответ
                  </label>
                  <textarea
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    placeholder="Введите ответ..."
                    required
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setSelectedRequest(null)}
                    style={{ padding: '10px 20px' }}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={respondToRequest}
                    disabled={responding || !response.trim()}
                    style={{ padding: '10px 20px' }}
                  >
                    {responding ? 'Отправка...' : 'Отправить ответ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

