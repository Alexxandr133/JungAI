import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';

type Session = {
  id: string;
  date: string;
  summary?: string;
  videoUrl?: string;
  createdAt: string;
};

type Event = {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  sessionStatus?: 'pending' | 'accepted' | 'declined';
  sessionDeclineComment?: string;
  voiceRoom?: {
    id: string;
    roomId: string;
    roomUrl: string;
  };
};

export default function ClientSessions() {
  const { token } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [declineComment, setDeclineComment] = useState<Record<string, string>>({});
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [sessionsRes, eventsRes] = await Promise.all([
          api<{ items: Session[] }>('/api/my-sessions', { token }),
          api<{ items: Event[] }>('/api/my-events', { token })
        ]);
        setSessions(sessionsRes.items || []);
        setEvents(eventsRes.items || []);
      } catch (e: any) {
        setError(e.message || 'Не удалось загрузить сессии');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSessionStatus(eventId: string, status: 'accepted' | 'declined') {
    if (!token) return;
    
    setProcessing(eventId);
    try {
      await api(`/api/events/${eventId}/session-status`, {
        method: 'PUT',
        token,
        body: {
          status,
          comment: status === 'declined' ? declineComment[eventId] : undefined
        }
      });
      
      // Обновляем локальное состояние
      setEvents(prev => prev.map(ev => 
        ev.id === eventId 
          ? { ...ev, sessionStatus: status, sessionDeclineComment: status === 'declined' ? declineComment[eventId] : undefined }
          : ev
      ));
      
      setShowDeclineModal(null);
      setDeclineComment(prev => ({ ...prev, [eventId]: '' }));
    } catch (e: any) {
      alert(e.message || 'Не удалось обновить статус сессии');
    } finally {
      setProcessing(null);
    }
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${date} в ${time}`;
  }

  function isUpcoming(date: string) {
    return new Date(date) > new Date();
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Сессии с психологом</h1>
        </div>

        {loading && (
          <div style={{ marginTop: 24, textAlign: 'center', padding: 24 }}>
            <div className="small" style={{ opacity: 0.7 }}>Загрузка сессий...</div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)', borderRadius: 12, color: '#ff7b7b' }}>
            {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div style={{ marginTop: 24, padding: 24, background: 'var(--surface-2)', borderRadius: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Сессии с психологом</div>
            <div style={{ color: 'var(--text-muted)' }}>Ваш психолог пока не назначил сессий. Сессии будут отображаться здесь после назначения.</div>
          </div>
        )}

        {/* Приглашения на сессии (события) */}
        {!loading && !error && events.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Приглашения на сессии</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {events.map(event => {
                const upcoming = isUpcoming(event.startsAt);
                const isPending = event.sessionStatus === 'pending' || !event.sessionStatus;
                const isAccepted = event.sessionStatus === 'accepted';
                const isDeclined = event.sessionStatus === 'declined';
                
                return (
                  <div key={event.id} className="card" style={{ 
                    padding: 20, 
                    border: isPending && upcoming ? '2px solid var(--primary)' : isDeclined ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                    background: isPending && upcoming 
                      ? 'linear-gradient(135deg, var(--primary)11, var(--accent)11)' 
                      : isDeclined 
                        ? 'rgba(244, 67, 54, 0.05)' 
                        : isAccepted
                          ? 'rgba(76, 175, 80, 0.05)'
                          : 'var(--surface-2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          {isPending && upcoming && (
                            <span style={{ 
                              padding: '4px 8px', 
                              background: 'rgba(255, 193, 7, 0.2)', 
                              color: '#ffc107', 
                              borderRadius: 6, 
                              fontSize: 12, 
                              fontWeight: 700 
                            }}>
                              ⏳ Ожидает ответа
                            </span>
                          )}
                          {isAccepted && (
                            <span style={{ 
                              padding: '4px 8px', 
                              background: 'rgba(76, 175, 80, 0.2)', 
                              color: '#4caf50', 
                              borderRadius: 6, 
                              fontSize: 12, 
                              fontWeight: 700 
                            }}>
                              ✓ Принята
                            </span>
                          )}
                          {isDeclined && (
                            <span style={{ 
                              padding: '4px 8px', 
                              background: 'rgba(244, 67, 54, 0.2)', 
                              color: '#f44336', 
                              borderRadius: 6, 
                              fontSize: 12, 
                              fontWeight: 700 
                            }}>
                              ✗ Отклонена
                            </span>
                          )}
                          <div style={{ fontSize: 18, fontWeight: 700 }}>{event.title}</div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                          📅 {formatDateTime(event.startsAt)}
                        </div>
                        {event.description && (
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
                            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Описание:</div>
                            <div>{event.description}</div>
                          </div>
                        )}
                        {event.voiceRoom && (isAccepted || isPending) && (
                          <div style={{ marginTop: 12 }}>
                            <a
                              href={event.voiceRoom.roomUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="button"
                              style={{ padding: '8px 16px', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                            >
                              🎤 Войти в голосовую комнату
                            </a>
                          </div>
                        )}
                        {event.sessionDeclineComment && (
                          <div style={{ marginTop: 12, padding: 12, background: 'rgba(244, 67, 54, 0.1)', borderRadius: 8, border: '1px solid rgba(244, 67, 54, 0.2)' }}>
                            <div className="small" style={{ color: '#f44336', marginBottom: 4, fontWeight: 600 }}>Ваш комментарий:</div>
                            <div style={{ color: 'var(--text)' }}>{event.sessionDeclineComment}</div>
                          </div>
                        )}
                      </div>
                      {isPending && upcoming && (
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column', flexShrink: 0 }}>
                          <button
                            className="button"
                            onClick={() => handleSessionStatus(event.id, 'accepted')}
                            disabled={processing === event.id}
                            style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
                          >
                            {processing === event.id ? '...' : '✓ Принять'}
                          </button>
                          <button
                            className="button danger"
                            onClick={() => setShowDeclineModal(event.id)}
                            disabled={processing === event.id}
                            style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
                          >
                            ✗ Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Прошедшие сессии */}
        {!loading && !error && sessions.length > 0 && (
          <div style={{ marginTop: events.length > 0 ? 32 : 24 }}>
            {events.length > 0 && <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Прошедшие сессии</h2>}
            <div style={{ display: 'grid', gap: 12 }}>
              {sessions.map(session => {
                const upcoming = isUpcoming(session.date);
                return (
                  <div key={session.id} className="card" style={{ 
                    padding: 20, 
                    border: upcoming ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                    background: upcoming ? 'linear-gradient(135deg, var(--primary)11, var(--accent)11)' : 'var(--surface-2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {upcoming && (
                            <span style={{ 
                              padding: '4px 8px', 
                              background: 'var(--primary)', 
                              color: '#0b0f1a', 
                              borderRadius: 6, 
                              fontSize: 12, 
                              fontWeight: 700 
                            }}>
                              Предстоящая
                            </span>
                          )}
                          <div style={{ fontSize: 18, fontWeight: 700 }}>Сессия с психологом</div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                          📅 {formatDateTime(session.date)}
                        </div>
                        {session.summary && (
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
                            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Описание:</div>
                            <div>{session.summary}</div>
                          </div>
                        )}
                        {session.videoUrl && (
                          <div style={{ marginTop: 12 }}>
                            <a 
                              href={session.videoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="button secondary"
                              style={{ padding: '8px 16px', fontSize: 13, textDecoration: 'none', display: 'inline-block' }}
                            >
                              📹 Открыть видеозапись
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && events.length === 0 && (
          <div style={{ marginTop: 24, padding: 24, background: 'var(--surface-2)', borderRadius: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Сессии с психологом</div>
            <div style={{ color: 'var(--text-muted)' }}>Ваш психолог пока не назначил сессий. Сессии будут отображаться здесь после назначения.</div>
          </div>
        )}

        {/* Модальное окно для отклонения сессии */}
        {showDeclineModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.72)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowDeclineModal(null)}>
            <div className="card" style={{ width: 'min(500px, 96vw)', padding: 22, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 26px 80px rgba(0,0,0,0.6)', borderRadius: 18 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>Отклонить приглашение на сессию</h3>
              <div style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
                Вы можете оставить комментарий, объясняющий причину отклонения (необязательно):
              </div>
              <textarea
                value={declineComment[showDeclineModal] || ''}
                onChange={e => setDeclineComment(prev => ({ ...prev, [showDeclineModal]: e.target.value }))}
                placeholder="Комментарий (необязательно)"
                style={{ width: '100%', padding: '12px', borderRadius: 8, marginBottom: 16, minHeight: 100, resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="button secondary" onClick={() => setShowDeclineModal(null)} style={{ padding: '8px 16px' }}>
                  Отмена
                </button>
                <button 
                  className="button danger" 
                  onClick={() => handleSessionStatus(showDeclineModal, 'declined')}
                  disabled={processing === showDeclineModal}
                  style={{ padding: '8px 16px' }}
                >
                  {processing === showDeclineModal ? 'Отклонение...' : 'Отклонить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

