import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';

type VerificationRequest = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
  phone?: string;
  location?: string;
  specialization?: string;
  experience?: string;
  bio?: string;
  documentPath: string;
  fileName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  comment?: string;
};

export default function AdminVerification() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Функция для получения правильного URL аватара
  const getAvatarUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const env = (import.meta as any).env || {};
    let baseOrigin: string = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
    if (!baseOrigin && env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '4000') {
      baseOrigin = 'http://localhost:4000';
    }
    if (!baseOrigin && typeof window !== 'undefined') {
      baseOrigin = window.location.origin;
    }
    return `${baseOrigin}${url}`;
  };


  useEffect(() => {
    loadRequests();
  }, [token]);

  async function loadRequests() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ requests: VerificationRequest[] }>('/api/admin/verification', { token });
      setRequests(res.requests || []);
    } catch (e: any) {
      console.error('Failed to load verification requests:', e);
    } finally {
      setLoading(false);
    }
  }

  async function reviewRequest(requestId: string, status: 'approved' | 'rejected') {
    if (!token || reviewing) return;
    setReviewing(true);
    try {
      await api(`/api/admin/verification/${requestId}/review`, {
        method: 'POST',
        token,
        body: { status, comment: reviewComment.trim() || undefined }
      });
      await loadRequests();
      setSelectedRequest(null);
      setReviewComment('');
    } catch (e: any) {
      console.error('Failed to review request:', e);
    } finally {
      setReviewing(false);
    }
  }

  function openRequest(request: VerificationRequest) {
    setSelectedRequest(request);
    setReviewComment(request.comment || '');
  }

  async function openDocument(requestId: string) {
    if (!token) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/admin/verification/${requestId}/document`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load document');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Очищаем URL после загрузки (опционально, можно оставить для кеширования)
      // setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (e: any) {
      console.error('Failed to open document:', e);
      alert('Не удалось открыть документ');
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const reviewedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Верификация психологов</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Проверка документов и верификация аккаунтов психологов
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>Загрузка...</div>
        ) : (
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Ожидают проверки */}
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
                Ожидают проверки
                {pendingRequests.length > 0 && (
                  <span style={{ marginLeft: 12, background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 14 }}>
                    {pendingRequests.length}
                  </span>
                )}
              </h2>
              {pendingRequests.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Нет запросов на проверку</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Все запросы обработаны</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {pendingRequests.map(req => {
                    const avatarSrc = getAvatarUrl(req.avatarUrl);
                    const displayName = req.userName || req.userEmail || 'U';
                    const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
                    return (
                    <div key={req.id} className="card" style={{ padding: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            {avatarSrc ? (
                              <img 
                                key={avatarSrc}
                                src={avatarSrc} 
                                alt={req.userName || 'Аватар'} 
                                style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }}
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.style.display = 'none';
                                  const parent = img.parentElement;
                                  if (parent && !parent.querySelector('.avatar-fallback')) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'avatar-fallback';
                                    fallback.style.cssText = 'width: 48px; height: 48px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800;';
                                    fallback.textContent = initial;
                                    parent.insertBefore(fallback, img);
                                  }
                                }}
                              />
                            ) : null}
                            {!avatarSrc && (
                              <div style={{ width: 48, height: 48, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                                {initial}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 16 }}>{req.userName || req.userEmail || 'Психолог'}</div>
                              <div className="small" style={{ color: 'var(--text-muted)' }}>{req.userEmail}</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                            {req.phone && (
                              <div>
                                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Телефон:</div>
                                <div style={{ fontWeight: 600 }}>{req.phone}</div>
                              </div>
                            )}
                            {req.location && (
                              <div>
                                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Локация:</div>
                                <div style={{ fontWeight: 600 }}>{req.location}</div>
                              </div>
                            )}
                            {req.specialization && (
                              <div>
                                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Специализация:</div>
                                <div style={{ fontWeight: 600 }}>{req.specialization}</div>
                              </div>
                            )}
                            {req.experience && (
                              <div>
                                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Опыт:</div>
                                <div style={{ fontWeight: 600 }}>{req.experience}</div>
                              </div>
                            )}
                          </div>
                          {req.bio && (
                            <div style={{ marginBottom: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>О себе:</div>
                              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{req.bio}</div>
                            </div>
                          )}
                          <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Документ:</div>
                            <div style={{ fontWeight: 600 }}>{req.fileName}</div>
                            <div className="small" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                              Отправлен: {new Date(req.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button
                            className="button secondary"
                            onClick={() => openDocument(req.id)}
                            style={{ padding: '8px 14px', fontSize: 13 }}
                          >
                            📄 Просмотр
                          </button>
                          <button
                            className="button"
                            onClick={() => openRequest(req)}
                            style={{ padding: '8px 14px', fontSize: 13 }}
                          >
                            Проверить
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Обработанные */}
            {reviewedRequests.length > 0 && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Обработанные запросы</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {reviewedRequests.map(req => (
                    <div key={req.id} className="card" style={{ padding: 16, opacity: 0.8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{req.userName || req.userEmail || 'Психолог'}</div>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>{req.userEmail}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {req.status === 'approved' ? (
                            <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>✓ Одобрено</span>
                          ) : (
                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>✕ Отклонено</span>
                          )}
                          <span className="small" style={{ color: 'var(--text-muted)' }}>
                            {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString('ru-RU') : ''}
                          </span>
                        </div>
                      </div>
                      {req.comment && (
                        <div style={{ marginTop: 8, padding: 8, background: 'var(--surface-2)', borderRadius: 8 }}>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>Комментарий:</div>
                          <div style={{ fontSize: 14 }}>{req.comment}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Модальное окно проверки */}
        {selectedRequest && (
          <div onClick={(e) => { if (e.target === e.currentTarget) { setSelectedRequest(null); setReviewComment(''); } }} style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000 }}>
            <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(700px, 96vw)', maxHeight: '90vh', overflowY: 'auto', padding: 24, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 20 }}>Проверка документа</div>
                <button className="button secondary" onClick={() => { setSelectedRequest(null); setReviewComment(''); }} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {(() => {
                    const avatarSrc = getAvatarUrl(selectedRequest.avatarUrl);
                    const displayName = selectedRequest.userName || selectedRequest.userEmail || 'U';
                    const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
                    return avatarSrc ? (
                      <img 
                        key={avatarSrc}
                        src={avatarSrc} 
                        alt={selectedRequest.userName || 'Аватар'} 
                        style={{ width: 64, height: 64, borderRadius: 999, objectFit: 'cover' }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const parent = img.parentElement;
                          if (parent && !parent.querySelector('.avatar-fallback-modal')) {
                            const fallback = document.createElement('div');
                            fallback.className = 'avatar-fallback-modal';
                            fallback.style.cssText = 'width: 64px; height: 64px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800; font-size: 24px;';
                            fallback.textContent = initial;
                            parent.insertBefore(fallback, img);
                          }
                        }}
                      />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 24 }}>
                        {initial}
                      </div>
                    );
                  })()}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selectedRequest.userName || selectedRequest.userEmail || 'Психолог'}</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>{selectedRequest.userEmail}</div>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {selectedRequest.phone && (
                    <div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Телефон:</div>
                      <div style={{ fontWeight: 600 }}>{selectedRequest.phone}</div>
                    </div>
                  )}
                  {selectedRequest.location && (
                    <div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Локация:</div>
                      <div style={{ fontWeight: 600 }}>{selectedRequest.location}</div>
                    </div>
                  )}
                  {selectedRequest.specialization && (
                    <div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Специализация:</div>
                      <div style={{ fontWeight: 600 }}>{selectedRequest.specialization}</div>
                    </div>
                  )}
                  {selectedRequest.experience && (
                    <div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Опыт:</div>
                      <div style={{ fontWeight: 600 }}>{selectedRequest.experience}</div>
                    </div>
                  )}
                </div>
                
                {selectedRequest.bio && (
                  <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>О себе:</div>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>{selectedRequest.bio}</div>
                  </div>
                )}
                
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Документ</div>
                  <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{selectedRequest.fileName}</div>
                    <button
                      onClick={() => openDocument(selectedRequest.id)}
                      className="button secondary"
                      style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }}
                    >
                      📄 Открыть документ
                    </button>
                  </div>
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                    Комментарий {selectedRequest.status === 'pending' ? '(обязателен при отклонении)' : '(необязательно)'}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder={selectedRequest.status === 'pending' ? 'При отклонении комментарий обязателен...' : 'Добавьте комментарий к решению...'}
                    rows={4}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    className="button danger"
                    onClick={() => {
                      if (!reviewComment.trim()) {
                        alert('Комментарий обязателен при отклонении запроса');
                        return;
                      }
                      reviewRequest(selectedRequest.id, 'rejected');
                    }}
                    disabled={reviewing}
                    style={{ padding: '10px 20px', fontSize: 14 }}
                  >
                    {reviewing ? 'Обработка...' : 'Отклонить'}
                  </button>
                  <button
                    className="button"
                    onClick={() => reviewRequest(selectedRequest.id, 'approved')}
                    disabled={reviewing}
                    style={{ padding: '10px 20px', fontSize: 14 }}
                  >
                    {reviewing ? 'Обработка...' : 'Одобрить'}
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

