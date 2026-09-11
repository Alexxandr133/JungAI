import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import './admin.css';

type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

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
  status: SupportStatus;
  adminResponse: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
};

type StatusFilter = 'all' | SupportStatus;

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
};

const STATUS_BADGE: Record<SupportStatus, string> = {
  open: 'admin-badge admin-badge--open',
  in_progress: 'admin-badge admin-badge--progress',
  resolved: 'admin-badge admin-badge--resolved',
  closed: 'admin-badge admin-badge--closed',
};

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'open', label: 'Открытые' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'resolved', label: 'Решённые' },
  { id: 'closed', label: 'Закрытые' },
];

export default function AdminSupport() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<SupportStatus>('in_progress');
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) void loadRequests();
  }, [token]);

  async function loadRequests() {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api<{ items: SupportRequest[] }>('/api/admin/support/requests', { token });
      setRequests(res.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить запросы');
    } finally {
      setLoading(false);
    }
  }

  function openEditor(req: SupportRequest) {
    setSelectedRequest(req);
    setResponse(req.adminResponse || '');
    setStatus(req.status);
    setError(null);
  }

  async function respondToRequest() {
    if (!token || !selectedRequest) return;
    if (!response.trim() && !selectedRequest.adminResponse) return;

    setResponding(true);
    setError(null);
    try {
      await api(`/api/admin/support/requests/${selectedRequest.id}/respond`, {
        method: 'POST',
        token,
        body: {
          adminResponse: response.trim() || selectedRequest.adminResponse || '',
          status,
        },
      });
      setSelectedRequest(null);
      setResponse('');
      await loadRequests();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить ответ');
    } finally {
      setResponding(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: requests.length,
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };
    for (const r of requests) c[r.status] += 1;
    return c;
  }, [requests]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      const hay = `${r.title} ${r.description} ${r.psychologistName || ''} ${r.psychologistEmail || ''} ${r.client?.name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [requests, filter, query]);

  const openAccessCount = requests.filter(
    (r) => r.allowWorkAreaAccess && ['open', 'in_progress'].includes(r.status)
  ).length;

  return (
    <div className="admin-shell">
      <AdminNavbar />
      <main className="admin-main">
        <header className="admin-head">
          <div>
            <p className="admin-head__eyebrow">Операции</p>
            <h1 className="admin-head__title">Тех. запросы</h1>
            <p className="admin-head__lead">
              Очередь поддержки: фильтры по статусу, повторные ответы и смена статуса.
            </p>
          </div>
          <div className="admin-head__actions">
            {openAccessCount > 0 ? (
              <Link to="/admin/open-access" className="button">
                Открытый функционал ({openAccessCount})
              </Link>
            ) : null}
            <button type="button" className="button secondary" onClick={() => void loadRequests()}>
              Обновить
            </button>
          </div>
        </header>

        {error && !selectedRequest ? <div className="admin-alert admin-alert--err">{error}</div> : null}

        <div className="admin-filters">
          <input
            className="admin-filters__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по теме, автору, клиенту…"
            type="search"
          />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`admin-chip${filter === f.id ? ' is-on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span style={{ opacity: 0.65, marginLeft: 6 }}>{counts[f.id]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="admin-loading">Загрузка запросов…</div>
        ) : visible.length === 0 ? (
          <div className="admin-panel admin-empty">Нет запросов по текущему фильтру</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Запрос</th>
                  <th>Автор</th>
                  <th>Статус</th>
                  <th>Создан</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((req) => (
                  <tr key={req.id}>
                    <td style={{ maxWidth: 360 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{req.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.4 }}>
                        {req.description.slice(0, 120)}
                        {req.description.length > 120 ? '…' : ''}
                      </div>
                      {req.allowWorkAreaAccess && req.client ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--info)' }}>
                          Доступ к РО: {req.client.name}{' '}
                          {['open', 'in_progress'].includes(req.status) ? (
                            <Link
                              to={`/admin/open-access?request=${req.id}&client=${req.client.id}`}
                              style={{ marginLeft: 6, fontWeight: 600 }}
                            >
                              открыть
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {req.adminResponse ? (
                        <div
                          style={{
                            marginTop: 8,
                            padding: '8px 10px',
                            borderRadius: 10,
                            background: 'var(--brand-soft)',
                            fontSize: 12,
                            color: 'var(--ink-soft)',
                          }}
                        >
                          Ответ: {req.adminResponse.slice(0, 100)}
                          {req.adminResponse.length > 100 ? '…' : ''}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{req.psychologistName || 'Психолог'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{req.psychologistEmail}</div>
                    </td>
                    <td>
                      <span className={STATUS_BADGE[req.status]}>{STATUS_LABEL[req.status]}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--ink-muted)' }}>
                      {new Date(req.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <button type="button" className="button secondary" onClick={() => openEditor(req)}>
                        {req.adminResponse ? 'Изменить' : 'Ответить'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedRequest ? (
          <div
            className="admin-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(33, 30, 43, 0.5)',
              backdropFilter: 'blur(6px)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1100,
              padding: 16,
            }}
            onClick={() => setSelectedRequest(null)}
          >
            <div
              className="admin-panel"
              style={{ width: 'min(720px, 94vw)', maxHeight: '90vh', overflow: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-section__head" style={{ marginBottom: 16 }}>
                <h2 className="admin-section__title" style={{ fontSize: 22 }}>
                  {selectedRequest.adminResponse ? 'Обновить ответ' : 'Ответить на запрос'}
                </h2>
                <button type="button" className="button secondary" onClick={() => setSelectedRequest(null)}>
                  Закрыть
                </button>
              </div>

              {error ? <div className="admin-alert admin-alert--err">{error}</div> : null}

              <div className="admin-panel" style={{ background: 'var(--paper-soft)', boxShadow: 'none', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedRequest.title}</div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, color: 'var(--ink-soft)', fontSize: 14 }}>
                  {selectedRequest.description}
                </div>
              </div>

              <label className="admin-kpi__label" style={{ display: 'block', marginBottom: 6 }}>
                Статус
              </label>
              <select
                className="admin-filters__search"
                style={{ width: '100%', marginBottom: 14 }}
                value={status}
                onChange={(e) => setStatus(e.target.value as SupportStatus)}
              >
                {(Object.keys(STATUS_LABEL) as SupportStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>

              <label className="admin-kpi__label" style={{ display: 'block', marginBottom: 6 }}>
                Комментарий / ответ
              </label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={7}
                placeholder="Текст ответа пользователю…"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  color: 'var(--ink)',
                  font: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  marginBottom: 16,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="button secondary" onClick={() => setSelectedRequest(null)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => void respondToRequest()}
                  disabled={responding || (!response.trim() && !selectedRequest.adminResponse)}
                >
                  {responding ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
