import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { syncClientActivityPoints } from '../../lib/clientActivityPoints';
import { ClientNavbar } from '../../components/ClientNavbar';
import '../../styles/tokens.css';

const STORAGE_KEY = 'client_chat_history';

function useMobileChat(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [breakpoint]);
  return isMobile;
}

export default function ClientAIChat() {
  const { token, user } = useAuth();
  const isMobileView = useMobileChat(768);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !token || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    try {
      const response = await api<{
        message: string;
        conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
      }>('/api/ai/client/chat', {
        method: 'POST',
        token,
        body: { message: userMessage, conversationHistory: messages }
      });
      const next = response.conversationHistory;
      setMessages(next);
      try {
        if (next.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      if (token && user?.id) {
        syncClientActivityPoints(token, user.id).catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось отправить';
      setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    if (!window.confirm('Очистить историю диалога с помощником?')) return;
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ClientNavbar />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: isMobileView ? '14px clamp(12px, 4vw, 20px) 20px' : '20px clamp(20px, 4vw, 48px)',
          maxWidth: isMobileView ? 560 : 'min(100%, 1320px)',
          margin: '0 auto',
          width: '100%',
          minHeight: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: isMobileView ? 12 : 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Link
                to="/client"
                className="small"
                style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: isMobileView ? 12 : undefined }}
              >
                ← Главная
              </Link>
            </div>
            <h1 style={{ margin: 0, fontSize: isMobileView ? 20 : 28, fontWeight: 800 }}>ИИ-помощник</h1>
            <p
              className="small"
              style={{
                margin: '8px 0 0',
                color: 'var(--text-muted)',
                maxWidth: isMobileView ? 420 : 640,
                lineHeight: 1.5,
                fontSize: isMobileView ? 12 : 14
              }}
            >
              Мягкая рефлексия и поддержка в формулировках. Не заменяет психолога: без диагнозов и жёстких интерпретаций снов.
            </p>
          </div>
          {messages.length > 0 && (
            <button type="button" className="button secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={clearHistory}>
              Очистить чат
            </button>
          )}
        </div>

        <div
          className="card"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: isMobileView ? 'min(48vh, 360px)' : 'min(72vh, 720px)',
            padding: 0,
            overflow: 'hidden',
            borderRadius: isMobileView ? 12 : 16
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobileView ? 14 : 20,
              display: 'flex',
              flexDirection: 'column',
              gap: isMobileView ? 10 : 12,
              background: 'var(--surface-2)'
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  maxWidth: 400,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                  fontSize: isMobileView ? 13 : 15
                }}
              >
                <div style={{ fontSize: isMobileView ? 32 : 40, marginBottom: 12 }}>🌙</div>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Начните диалог</div>
                <div>Можно описать настроение, задать вопрос о процессе терапии или попросить помочь сформулировать мысль для сессии.</div>
                <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85 }}>
                  Пример: «Как мягче рассказать психологу, что мне тревожно?»
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    background:
                      msg.role === 'user'
                        ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                        : 'var(--surface)',
                    color: msg.role === 'user' ? '#0b0f1a' : 'var(--text)',
                    fontSize: isMobileView ? 13 : 14,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none'
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: 'var(--surface)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 14,
                    color: 'var(--text-muted)'
                  }}
                >
                  Печатаю…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            onSubmit={onSubmit}
            style={{
              display: 'flex',
              gap: isMobileView ? 8 : 10,
              padding: isMobileView ? 12 : 16,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'var(--surface)'
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={token ? 'Напишите сообщение…' : 'Войдите, чтобы писать помощнику'}
              disabled={loading || !token}
              style={{
                flex: 1,
                padding: isMobileView ? '10px 12px' : '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: isMobileView ? 14 : 15
              }}
            />
            <button
              type="submit"
              className="button"
              disabled={loading || !input.trim() || !token}
              style={{ padding: isMobileView ? '10px 14px' : '12px 22px', fontSize: isMobileView ? 13 : undefined }}
            >
              Отправить
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
