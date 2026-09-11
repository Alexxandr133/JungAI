import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import { Link, useSearchParams } from 'react-router-dom';
import WorkArea from '../psychologist/WorkArea';
import './admin.css';

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
  createdAt: string;
};

export default function AdminOpenAccess() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRequestId = searchParams.get('request');
  const selectedClientId = searchParams.get('client');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);

  useEffect(() => {
    if (token) {
      loadRequests();
    }
  }, [token]);

  useEffect(() => {
    if (selectedRequestId) {
      if (requests.length > 0) {
        const req = requests.find(r => r.id === selectedRequestId);
        if (req) {
          setSelectedRequest(req);
        }
      } else {
        // Если запросы еще не загружены, но есть selectedRequestId, загружаем запрос отдельно
        loadSingleRequest(selectedRequestId);
      }
    }
  }, [selectedRequestId, requests]);

  async function loadSingleRequest(requestId: string) {
    if (!token) return;
    try {
      const res = await api<{ items: SupportRequest[] }>('/api/admin/support/open-access', { token });
      const req = res.items.find(r => r.id === requestId);
      if (req) {
        setSelectedRequest(req);
      }
    } catch (e: any) {
      console.error('Failed to load request:', e);
    }
  }

  // Обновляем URL для WorkArea когда выбран клиент
  useEffect(() => {
    if (selectedClientId) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('client', selectedClientId);
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [selectedClientId]);

  async function loadRequests() {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api<{ items: SupportRequest[] }>('/api/admin/support/open-access', { token });
      setRequests(res.items || []);
    } catch (e: any) {
      console.error('Failed to load requests:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenWorkArea = (requestId: string, clientId: string) => {
    setSearchParams({ request: requestId, client: clientId });
  };

  // Если выбран клиент, показываем рабочую область
  if (selectedClientId) {

    return (
      <div className="admin-shell">
        <AdminNavbar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px clamp(16px, 4vw, 40px)',
              borderBottom: '1px solid var(--line)',
              background: 'var(--card)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Link
                    to="/admin/open-access"
                    className="button secondary"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                  >
                    ← Назад к списку
                  </Link>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {selectedRequest ? `Запрос: ${selectedRequest.title}` : 'Рабочая область клиента'}
                    </div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>
                      {selectedRequest ? (
                        <>
                          Клиент: {selectedRequest.client?.name || 'Не указан'} • 
                          Психолог: {selectedRequest.psychologistName || selectedRequest.psychologistEmail}
                        </>
                      ) : (
                        'Загрузка информации о запросе...'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {selectedRequest && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Описание проблемы:</div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{selectedRequest.description}</div>
              </div>
            )}
          </div>
          {/* Рабочая область */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <WorkArea key={selectedClientId} restrictedClientId={selectedClientId} hideNavbar={true} noPadding={true} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <AdminNavbar />
      <main className="admin-main">
        <header className="admin-head">
          <div>
            <p className="admin-head__eyebrow">Операции</p>
            <h1 className="admin-head__title">Открытый функционал</h1>
            <p className="admin-head__lead">
              Доступ к рабочим областям клиентов по запросам техподдержки
            </p>
          </div>
          <Link to="/admin/support" className="button secondary">
            ← Тех. запросы
          </Link>
        </header>

        {loading ? (
          <div className="admin-loading">Загрузка…</div>
        ) : requests.length === 0 ? (
          <div className="admin-panel admin-empty">Нет открытых доступов</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {requests.map((req) => (
              <div key={req.id} className="admin-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>{req.title}</h3>
                    <p className="admin-list__meta" style={{ marginBottom: 10 }}>
                      Психолог: {req.psychologistName || req.psychologistEmail} · Клиент:{' '}
                      {req.client?.name || 'Не указан'} · {new Date(req.createdAt).toLocaleString('ru-RU')}
                    </p>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: 14, color: 'var(--ink-soft)' }}>
                      {req.description}
                    </div>
                    {req.client ? (
                      <button
                        type="button"
                        className="button"
                        style={{ marginTop: 14 }}
                        onClick={() => handleOpenWorkArea(req.id, req.client!.id)}
                      >
                        Открыть рабочую область
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

