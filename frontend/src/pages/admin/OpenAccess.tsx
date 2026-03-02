import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { Link, useSearchParams } from 'react-router-dom';
import WorkArea from '../psychologist/WorkArea';

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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header с информацией о запросе */}
          <div style={{ padding: '16px 48px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface)', flexShrink: 0 }}>
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Открытый функционал</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Доступ к рабочим областям клиентов для решения проблем
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : requests.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔓</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Нет открытых доступов</div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Запросы с разрешением доступа к рабочей области появятся здесь
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {requests.map(req => (
              <div key={req.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{req.title}</h3>
                    </div>
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                      Психолог: {req.psychologistName || req.psychologistEmail} • 
                      Клиент: {req.client?.name || 'Не указан'} • 
                      {new Date(req.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {req.client && (
                      <div style={{ padding: 12, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, marginBottom: 12 }}>
                        <div className="small" style={{ color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>
                          🔓 Доступ к рабочей области: {req.client.name}
                        </div>
                        <button
                          className="button"
                          onClick={() => handleOpenWorkArea(req.id, req.client!.id)}
                          style={{ padding: '8px 16px', fontSize: 14, marginTop: 8 }}
                        >
                          Открыть рабочую область
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Описание проблемы:</div>
                  <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

