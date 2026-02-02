import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';

type SupportRequest = {
  id: string;
  title: string;
  description: string;
  allowWorkAreaAccess: boolean;
  clientId: string | null;
  client?: { id: string; name: string; email: string | null } | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
};

export default function PsychologistSupport() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allowWorkAreaAccess, setAllowWorkAreaAccess] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadRequests();
      loadClients();
    }
  }, [token]);

  async function loadRequests() {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api<{ items: SupportRequest[] }>('/api/support/requests', { token });
      setRequests(res.items || []);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить запросы');
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    if (!token) return;
    try {
      const res = await api<{ items: Array<{ id: string; name: string; email: string | null }> }>('/api/clients', { token });
      setClients(res.items || []);
    } catch (e: any) {
      console.error('Failed to load clients:', e);
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !title.trim() || !description.trim()) return;
    
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/support/requests', {
        method: 'POST',
        token,
        body: {
          title: title.trim(),
          description: description.trim(),
          allowWorkAreaAccess,
          clientId: allowWorkAreaAccess && selectedClientId ? selectedClientId : null
        }
      });
      setTitle('');
      setDescription('');
      setAllowWorkAreaAccess(false);
      setSelectedClientId('');
      setShowModal(false);
      await loadRequests();
    } catch (e: any) {
      setError(e.message || 'Не удалось создать запрос');
    } finally {
      setSubmitting(false);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Тех.поддержка</h1>
            <div className="small" style={{ color: 'var(--text-muted)' }}>Создайте запрос, если у вас возникли проблемы</div>
          </div>
          <button className="button" onClick={() => setShowModal(true)} style={{ padding: '10px 20px' }}>
            Создать запрос
          </button>
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
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Создайте первый запрос в техподдержку</div>
            <button className="button" onClick={() => setShowModal(true)}>Создать запрос</button>
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
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                      Создан: {new Date(req.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {req.allowWorkAreaAccess && req.client && (
                      <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, marginBottom: 12 }}>
                        <div className="small" style={{ color: '#3b82f6', fontWeight: 600 }}>
                          🔓 Доступ к рабочей области: {req.client.name}
                        </div>
                      </div>
                    )}
                  </div>
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

        {/* Modal для создания запроса */}
        {showModal && (
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
            onClick={() => setShowModal(false)}
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
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Создать запрос</h2>
                <button
                  className="button secondary"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '6px 10px', fontSize: 13 }}
                >
                  Закрыть
                </button>
              </div>
              <form onSubmit={createRequest} style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>
                    Заголовок
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Краткое описание проблемы"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>
                    Описание проблемы
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Подробно опишите проблему..."
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
                <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowWorkAreaAccess}
                      onChange={e => setAllowWorkAreaAccess(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Открыть доступ к рабочей области для решения проблемы</div>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>
                        Администратор получит доступ к рабочей области выбранного клиента
                      </div>
                    </div>
                  </label>
                  {allowWorkAreaAccess && (
                    <div style={{ marginTop: 12 }}>
                      <label className="small" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>
                        Выберите клиента
                      </label>
                      <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        required={allowWorkAreaAccess}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: 14
                        }}
                      >
                        <option value="">Выберите клиента</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.email ? `(${c.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setShowModal(false)}
                    style={{ padding: '10px 20px' }}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="button"
                    disabled={submitting || !title.trim() || !description.trim()}
                    style={{ padding: '10px 20px' }}
                  >
                    {submitting ? 'Отправка...' : 'Отправить запрос'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

