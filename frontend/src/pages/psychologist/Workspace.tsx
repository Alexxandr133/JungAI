import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import '../../styles/tokens.css';

export default function PsychologistWorkspace() {
  const { token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [events, setEvents] = useState<any[]>([]);
  const [dreams, setDreams] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);

  // Check verification status
  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      return;
    }
    
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token]);

  // Загружаем историю чата из localStorage при монтировании
  useEffect(() => {
    const savedChat = localStorage.getItem('psychologist_chat_history');
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved chat history:', e);
      }
    }
  }, []);

  // Сохраняем историю чата в localStorage при каждом изменении
  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem('psychologist_chat_history', JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  const getAvatarUrl = (url: string | null | undefined, clientId?: string) => {
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
    const separator = url.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    params.set('t', Date.now().toString());
    return `${baseOrigin}${url}${separator}${params.toString()}`;
  };

  useEffect(() => {
    // Не загружаем данные, если не верифицирован
    if (isVerified === false) return;
    
    (async () => {
      if (!token) {
        // Populate with local placeholders without hitting API when unauthenticated
        setEvents(prev => prev.length ? prev : [
          { id: 'e1', title: 'Сессия: Иван', startsAt: new Date().toISOString() },
          { id: 'e2', title: 'Супервизия: Анна', startsAt: new Date(Date.now()+3600e3).toISOString() },
          { id: 'e3', title: 'Анализ сна: Мария', startsAt: new Date(Date.now()+7200e3).toISOString() }
        ]);
        setDreams(prev => prev.length ? prev : [
          { id: 'd1', title: 'Лечу над горящим городом', createdAt: new Date().toISOString() },
          { id: 'd2', title: 'Красная дверь и коридор', createdAt: new Date().toISOString() }
        ]);
        setMessages(prev => prev.length ? prev : [
          { id: 'm1', content: 'Добрый день! Могу ли перенести сессию?' },
          { id: 'm2', content: 'Добавил запись в дневник.' }
        ]);
        return;
      }
      try { const ev = await api<{ items: any[] }>('/api/events', { token }); setEvents(ev.items.slice(0, 6)); } catch (e: any) {
        if (e.message?.includes('Verification required')) {
          const result = await checkVerification(token);
          setIsVerified(result.isVerified);
          setVerificationStatus(result.status);
        }
      }
      try { const cl = await api<{ items: any[] }>('/api/clients', { token }); setClients(cl.items || []); } catch (e: any) {
        if (e.message?.includes('Verification required')) {
          const result = await checkVerification(token);
          setIsVerified(result.isVerified);
          setVerificationStatus(result.status);
        }
      }
      try { const d = await api<{ items: any[]; total: number }>('/api/dreams', { token }); setDreams(d.items.slice(0, 8)); } catch (e: any) {
        if (e.message?.includes('Verification required')) {
          const result = await checkVerification(token);
          setIsVerified(result.isVerified);
          setVerificationStatus(result.status);
        }
      }
      try { const r = await api<{ items: any[] }>('/api/chat/rooms', { token }); if (r.items[0]) { const m = await api<{ items: any[] }>(`/api/chat/rooms/${r.items[0].id}/messages`, { token }); setMessages(m.items.slice(-6)); } } catch (e: any) {
        if (e.message?.includes('Verification required')) {
          const result = await checkVerification(token);
          setIsVerified(result.isVerified);
          setVerificationStatus(result.status);
        }
      }
      setEvents(prev => prev.length ? prev : [
        { id: 'e1', title: 'Сессия: Иван', startsAt: new Date().toISOString() },
        { id: 'e2', title: 'Супервизия: Анна', startsAt: new Date(Date.now()+3600e3).toISOString() },
        { id: 'e3', title: 'Анализ сна: Мария', startsAt: new Date(Date.now()+7200e3).toISOString() }
      ]);
      setDreams(prev => prev.length ? prev : [
        { id: 'd1', title: 'Лечу над горящим городом', createdAt: new Date().toISOString() },
        { id: 'd2', title: 'Красная дверь и коридор', createdAt: new Date().toISOString() }
      ]);
      setMessages(prev => prev.length ? prev : [
        { id: 'm1', content: 'Добрый день! Могу ли перенести сессию?' },
        { id: 'm2', content: 'Добавил запись в дневник.' }
      ]);
    })();
  }, [token, isVerified]);

  // Show verification required message
  if (isVerified === false && token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    // Search is handled by the query state
  }

  function formatEventDateTime(iso: string) {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const weekday = d.toLocaleDateString('ru-RU', { weekday: 'long' });
    const day = d.toLocaleDateString('ru-RU', { day: 'numeric' });
    return `${time} · ${weekday}, ${day}`;
  }

  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !token || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await api<{ message: string; conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> }>(
        '/api/ai/psychologist/chat',
        {
          method: 'POST',
          token,
          body: {
            message: userMessage,
            conversationHistory: chatMessages
          }
        }
      );
      setChatMessages(response.conversationHistory);
    } catch (error: any) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Ошибка: ${error.message || 'Не удалось отправить сообщение'}` 
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleClearChat() {
    if (window.confirm('Вы уверены, что хотите очистить историю чата?')) {
      setChatMessages([]);
      localStorage.removeItem('psychologist_chat_history');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 600 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: 10, opacity: .7 }}>🔎</span>
              <input style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', minWidth: 0 }} placeholder="Поиск: клиенты, сны, архетипы" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </form>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to="/psychologist/work-area" className="button" style={{ padding: '10px 14px' }}>{t('psychologist.workArea')}</Link>
            <div title="Уведомления" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', position: 'relative', cursor: 'pointer' }}>🔔<span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--accent)', color: '#0b0d12', borderRadius: 999, fontSize: 10, padding: '2px 6px' }}>{dreams.length}</span></div>
            <div title="Сообщения" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', position: 'relative', cursor: 'pointer' }}>💬<span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--accent)', color: '#0b0d12', borderRadius: 999, fontSize: 10, padding: '2px 6px' }}>{messages.length}</span></div>
          </div>
        </div>

        {/* Today's Snapshot */}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(280px, 1fr))', gap: 10 }}>
          <div className="card card-hover-shimmer" style={{ padding: 14, cursor: 'pointer' }} onClick={() => navigate('/events')}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>📅 {t('psychologist.upcomingSessions')}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {events.slice(0,3).map(ev => (
                <li key={ev.id} className="small">{ev.title} — {formatEventDateTime(ev.startsAt)}</li>
              ))}
              {events.length === 0 && <li className="small">Нет запланированных сессий</li>}
            </ul>
          </div>
          <div className="card card-hover-shimmer" style={{ padding: 14, cursor: 'pointer' }} onClick={() => navigate('/dreams')}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>📝 {t('psychologist.newDreams24h')}</div>
            <div className="small">Всего: <b>{dreams.length}</b></div>
            {dreams[0] && (
              <div className="small" style={{ marginTop: 6 }}>Превью: <b>{dreams[0].title}</b></div>
            )}
          </div>
          <div className="card card-hover-shimmer" style={{ padding: 14, cursor: 'pointer' }} onClick={() => navigate('/ai/recommendations')}>
            <div style={{ fontWeight: 800 }}>🔍 {t('psychologist.aiAnalytics')}</div>
          </div>
        </div>

        {/* Мои клиенты */}
        <div style={{ marginTop: 10 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800 }}>{t('psychologist.myClients')}</div>
              <Link to="/clients" className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>{t('psychologist.all')}</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
              {clients.slice(0, 8).map(c => (
                <div key={c.id} className="card" style={{ padding: 10, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center' }}>
                  {getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl) ? (
                    <img
                      src={getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl) || ''}
                      alt={c.name || 'Аватар'}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(255,255,255,0.1)'
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.avatar-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'avatar-fallback';
                          fallback.style.cssText = 'width: 40px; height: 40px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800;';
                          fallback.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                      {(c.name || '?').trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Клиент'}</div>
                    <div className="small" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '—'}</div>
                  </div>
                </div>
              ))}
              {clients.length === 0 && (
                <div className="small" style={{ opacity: .8 }}>Нет клиентов. Добавьте в разделе «Клиенты».</div>
              )}
            </div>
          </div>
        </div>

        {/* Чат с ИИ-ассистентом */}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', height: '500px' }}>
            <div style={{ fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🤖</span>
                <span>{t('psychologist.aiAssistant')}</span>
              </div>
              {chatMessages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="button secondary"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: 12,
                    whiteSpace: 'nowrap'
                  }}
                  title={t('psychologist.clearChat')}
                >
                  🗑️ {t('psychologist.clearChat')}
                </button>
              )}
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              marginBottom: 12, 
              padding: 12, 
              background: 'var(--surface-2)', 
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {chatMessages.length === 0 && (
                <div style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: 14, 
                  textAlign: 'center', 
                  padding: '20px 0',
                  lineHeight: 1.6
                }}>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>Добро пожаловать!</div>
                  <div>Я ваш ассистент-психолог. Помогаю с амплификациями, анализом символов и интерпретацией снов.</div>
                  <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
                    Попробуйте спросить: "Какие сны снились сегодня моим пациентам?"
                  </div>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    gap: 8
                  }}
                >
                  <div style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: msg.role === 'user' 
                      ? 'linear-gradient(135deg, var(--primary), var(--accent))' 
                      : 'var(--surface-3)',
                    color: msg.role === 'user' ? '#0b0f1a' : 'var(--text)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--surface-3)',
                    color: 'var(--text)',
                    fontSize: 14
                  }}>
                    Думаю...
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleChatSend} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={t('psychologist.askAssistant')}
                disabled={chatLoading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="button"
                style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
              >
                {chatLoading ? '...' : t('psychologist.send')}
              </button>
            </form>
          </div>
        </div>

      </main>
    </div>
  );
}
