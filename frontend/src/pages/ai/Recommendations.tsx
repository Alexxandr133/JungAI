import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { UserMenu } from '../../components/ui';
import { PlatformIcon } from '../../components/icons';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};

export default function AIRecommendationsPage() {
  const { token, user } = useAuth();
  const isPsychologist = user?.role === 'psychologist' || user?.role === 'admin';
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];



  // Check verification status for psychologists
  useEffect(() => {
    if (!token || !isPsychologist) {
      setIsVerified(null);
      return;
    }
    
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token, isPsychologist]);

  // Загрузка сессий из localStorage при монтировании
  useEffect(() => {
    if (!user?.id) return;
    const storageKey = `ai_chat_sessions_${user.id}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sessionsData: ChatSession[] = parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          messages: s.messages.map((m: any) => ({ ...m, timestamp: m.timestamp ? new Date(m.timestamp) : undefined }))
        }));
        setSessions(sessionsData);
        if (sessionsData.length > 0 && !activeSessionId) {
          setActiveSessionId(sessionsData[0].id);
        } else if (sessionsData.length === 0) {
          // Создаем первую сессию
          const newSession: ChatSession = {
            id: `chat-${Date.now()}`,
            title: 'Новый чат',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
        }
      } else {
        // Создаем первую сессию
        const newSession: ChatSession = {
          id: `chat-${Date.now()}`,
          title: 'Новый чат',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: 'Новый чат',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
    }
  }, [user?.id]);

  // Сохранение сессий в localStorage
  useEffect(() => {
    if (sessions.length === 0 || !user?.id) return;
    const storageKey = `ai_chat_sessions_${user.id}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save chat sessions:', e);
    }
  }, [sessions, user?.id]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, loading, activeSessionId]);

  // Автоматическое изменение высоты textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);


  async function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim() || loading || !activeSessionId) return;
    if (isPsychologist && isVerified === false) {
      setError('Для использования чата с AI необходимо пройти верификацию');
      return;
    }
    
    const userText = input.trim();
    setInput('');
    setError(null);
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: new Date()
    };
    
    // Обновляем сессию с новым сообщением
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === activeSessionId) {
          const newMessages = [...s.messages, userMessage];
          // Обновляем заголовок на основе первого сообщения
          const newTitle = s.title === 'Новый чат' && newMessages.length === 1
            ? userText.slice(0, 50) + (userText.length > 50 ? '...' : '')
            : s.title;
          return {
            ...s,
            messages: newMessages,
            title: newTitle,
            updatedAt: new Date()
          };
        }
        return s;
      });
      return updated;
    });
    
    try {
      setLoading(true);
      
      // Используем AI ассистента психолога если это психолог
      if (user?.role === 'psychologist' || user?.role === 'admin') {
        const res = await api<{ reply?: string; message?: string }>('/api/ai/psychologist/chat', {
          method: 'POST',
          token: token ?? undefined,
          body: {
            message: userText,
            conversationHistory: messages.slice(-10).map(m => ({
              role: m.role,
              content: m.content
            }))
          }
        });
        
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: res.reply || res.message || 'Не удалось получить ответ',
          timestamp: new Date()
        };
        
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId 
            ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: new Date() }
            : s
        ));
      } else {
        // Для клиентов - анализ снов
        const res = await api('/api/ai/dream/analyze', {
          method: 'POST',
          token: token ?? undefined,
          body: {
            content: userText,
            symbols: []
          }
        });
        
        const reply = formatAnalysisReply(res);
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: reply,
          timestamp: new Date()
        };
        
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId 
            ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: new Date() }
            : s
        ));
      }
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить сообщение');
      // Удаляем последнее сообщение пользователя при ошибке
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: s.messages.slice(0, -1), updatedAt: new Date() }
          : s
      ));
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }

  function formatAnalysisReply(analysis: any): string {
    const parts: string[] = [];
    if (analysis?.emotions) parts.push(`**Эмоции:** ${Array.isArray(analysis.emotions) ? analysis.emotions.join(', ') : analysis.emotions}`);
    if (analysis?.archetypes) parts.push(`**Архетипы:** ${Array.isArray(analysis.archetypes) ? analysis.archetypes.join(', ') : analysis.archetypes}`);
    if (analysis?.frequency && Object.keys(analysis.frequency).length > 0) {
      const symbols = Object.entries(analysis.frequency)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 5)
        .map(([symbol, count]: any) => `${symbol} (${count})`)
        .join(', ');
      parts.push(`**Частые символы:** ${symbols}`);
    }
    if (analysis?.recommendations) {
      const recs = Array.isArray(analysis.recommendations) 
        ? analysis.recommendations.join(', ')
        : analysis.recommendations;
      parts.push(`**Рекомендации:** ${recs}`);
    }
    if (analysis?.suggestedAmplifications && analysis.suggestedAmplifications.length > 0) {
      const amps = analysis.suggestedAmplifications.map((a: any) => a.title || a.symbol).join(', ');
      parts.push(`**Предложенные амплификации:** ${amps}`);
    }
    return parts.length > 0 ? parts.join('\n\n') : 'Анализ завершен.';
  }

  function clearChat() {
    if (confirm('Очистить этот чат?')) {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: [], updatedAt: new Date() }
          : s
      ));
    }
  }

  // Show verification required message for psychologists
  if (isPsychologist && token && isVerified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          minWidth: 0,
          overflow: 'hidden',
          background: 'var(--surface)',
          padding: '24px clamp(12px, 4vw, 40px)'
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Чат с AI</h1>
              <div className="small" style={{ color: 'var(--text-muted)' }}>
                {user?.role === 'psychologist' || user?.role === 'admin' 
                  ? 'Ассистент психолога для работы с клиентами и анализа'
                  : 'Анализ снов и рекомендации'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="button secondary"
                style={{ padding: '8px 14px', fontSize: 13 }}
              >
                Очистить чат
              </button>
            )}
            <LanguageSwitcher />
            <UserMenu user={user as any} />
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollerRef}
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            minHeight: 0
          }}
        >
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '48px 20px' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 700 }}>Начните диалог с AI</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 500 }}>
                {user?.role === 'psychologist' || user?.role === 'admin'
                  ? 'Задайте вопрос о ваших клиентах, снах, сессиях или попросите помощи с анализом и амплификациями.'
                  : 'Опишите свой сон или задайте вопрос для анализа и получения рекомендаций.'}
              </p>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400, width: '100%' }}>
                {user?.role === 'psychologist' || user?.role === 'admin' ? (
                  <>
                    <button
                      onClick={() => setInput('Расскажи о моих клиентах')}
                      className="button secondary"
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <PlatformIcon name="chart" size={18} strokeWidth={1.75} style={{ flexShrink: 0, opacity: 0.9 }} />
                      Расскажи о моих клиентах
                    </button>
                    <button
                      onClick={() => setInput('Какие сны требуют анализа?')}
                      className="button secondary"
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <PlatformIcon name="dreams" size={18} strokeWidth={1.75} style={{ flexShrink: 0, opacity: 0.9 }} />
                      Какие сны требуют анализа?
                    </button>
                    <button
                      onClick={() => setInput('Помоги с амплификацией символа')}
                      className="button secondary"
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <PlatformIcon name="orbit" size={18} strokeWidth={1.75} style={{ flexShrink: 0, opacity: 0.9 }} />
                      Помоги с амплификацией символа
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setInput('Проанализируй мой сон')}
                      className="button secondary"
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <PlatformIcon name="dreams" size={18} strokeWidth={1.75} style={{ flexShrink: 0, opacity: 0.9 }} />
                      Проанализируй мой сон
                    </button>
                    <button
                      onClick={() => setInput('Что означают символы в моих снах?')}
                      className="button secondary"
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <PlatformIcon name="orbit" size={18} strokeWidth={1.75} style={{ flexShrink: 0, opacity: 0.9 }} />
                      Что означают символы в моих снах?
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  maxWidth: '85%',
                  marginLeft: message.role === 'user' ? 'auto' : 0,
                  marginRight: message.role === 'assistant' ? 'auto' : 0,
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: message.role === 'user' 
                      ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                      : 'var(--surface-2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    fontSize: 18
                  }}
                >
                  {message.role === 'user' ? '👤' : 'AI'}
                </div>
                
                {/* Message bubble */}
                <div
                  style={{
                    background: message.role === 'user'
                      ? 'var(--primary-ghost)'
                      : 'var(--surface-2)',
                    borderRadius: 18,
                    padding: '14px 18px',
                    border: `1px solid ${message.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: message.role === 'user' 
                      ? '0 2px 8px rgba(0,0,0,0.1)'
                      : '0 1px 3px rgba(0,0,0,0.1)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.6
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-muted)'
                }}
              >
                AI
              </div>
              <div
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 18,
                  padding: '14px 18px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center'
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface)' }}>
          {error && (
            <div style={{ marginBottom: 12, padding: 12, background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.3)', borderRadius: 10, color: '#ff7b7b', fontSize: 13 }}>
              {error}
            </div>
          )}
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={user?.role === 'psychologist' || user?.role === 'admin'
                  ? 'Задайте вопрос о клиентах, снах или попросите помощи с анализом...'
                  : 'Опишите сон или задайте вопрос...'}
                disabled={loading}
                style={{
                  width: '100%',
                  minHeight: 52,
                  maxHeight: 200,
                  padding: '14px 50px 14px 18px',
                  borderRadius: 24,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  fontSize: 15,
                  resize: 'none',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: loading || !input.trim() 
                  ? 'var(--surface-2)' 
                  : 'linear-gradient(135deg, var(--primary), var(--accent))',
                border: 'none',
                display: 'grid',
                placeItems: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              title="Отправить (Enter)"
            >
              {loading ? (
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <span style={{ fontSize: 20 }}>➤</span>
              )}
            </button>
          </form>
          <div className="small" style={{ marginTop: 8, textAlign: 'center', color: 'var(--text-muted)' }}>
            AI может допускать ошибки. Проверяйте важную информацию.
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

