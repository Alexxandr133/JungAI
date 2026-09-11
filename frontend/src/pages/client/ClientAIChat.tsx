import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Moon, Plus, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { syncClientActivityPoints } from '../../lib/clientActivityPoints';
import { ClientNavbar } from '../../components/ClientNavbar';
import './ClientAIChat.css';

type Msg = { role: 'user' | 'assistant'; content: string };
type ChatThread = {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: string;
};

const STORAGE_KEY = 'client_ai_chats_v2';
const LEGACY_KEY = 'client_chat_history';

const PROMPT_CHIPS = [
  'Как рассказать психологу о тревоге?',
  'Помоги сформулировать вопрос к сессии',
  'Что записать в дневник после тяжёлого дня?',
];

function uid() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadChats(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatThread[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const msgs = JSON.parse(legacy) as Msg[];
      if (Array.isArray(msgs) && msgs.length) {
        return [
          {
            id: uid(),
            title: msgs.find((m) => m.role === 'user')?.content.slice(0, 42) || 'Диалог',
            messages: msgs,
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    }
  } catch {
    /* ignore */
  }
  return [
    {
      id: uid(),
      title: 'Новый чат',
      messages: [],
      updatedAt: new Date().toISOString(),
    },
  ];
}

function useMobile(breakpoint = 900) {
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
  const isMobile = useMobile();
  const initialRef = useRef<{ chats: ChatThread[]; activeId: string } | null>(null);
  if (!initialRef.current) {
    const loaded = loadChats();
    initialRef.current = { chats: loaded, activeId: loaded[0]?.id || '' };
  }
  const [chats, setChats] = useState<ChatThread[]>(() => initialRef.current!.chats);
  const [activeId, setActiveId] = useState(() => initialRef.current!.activeId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [disclaimerShown, setDisclaimerShown] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const active = useMemo(() => chats.find((c) => c.id === activeId) || chats[0], [chats, activeId]);
  const messages = active?.messages || [];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      /* ignore */
    }
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, activeId]);

  function updateActive(patch: Partial<ChatThread> | ((prev: ChatThread) => ChatThread)) {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        return typeof patch === 'function' ? patch(c) : { ...c, ...patch, updatedAt: new Date().toISOString() };
      })
    );
  }

  function createChat() {
    const next: ChatThread = {
      id: uid(),
      title: 'Новый чат',
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setChats((prev) => [next, ...prev]);
    setActiveId(next.id);
    setSidebarOpen(false);
    setDisclaimerShown(false);
  }

  function deleteChat(id: string) {
    if (!window.confirm('Удалить этот чат?')) return;
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.length) {
        const fresh: ChatThread = {
          id: uid(),
          title: 'Новый чат',
          messages: [],
          updatedAt: new Date().toISOString(),
        };
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!input.trim() || !token || loading || !active) return;
    const userMessage = input.trim();
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';

    const historyBefore = messages;
    const withUser: Msg[] = [...historyBefore, { role: 'user', content: userMessage }];
    updateActive((c) => ({
      ...c,
      title: c.messages.length === 0 ? userMessage.slice(0, 48) : c.title,
      messages: withUser,
      updatedAt: new Date().toISOString(),
    }));
    setLoading(true);
    try {
      const response = await api<{
        message: string;
        conversationHistory: Msg[];
      }>('/api/ai/client/chat', {
        method: 'POST',
        token,
        body: { message: userMessage, conversationHistory: historyBefore },
      });
      const next = response.conversationHistory;
      updateActive({ messages: next });
      if (token && user?.id) {
        syncClientActivityPoints(token, user.id).catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось отправить';
      updateActive((c) => ({
        ...c,
        messages: [...c.messages, { role: 'assistant', content: `Ошибка: ${msg}` }],
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setLoading(false);
    }
  }

  function applyChip(text: string) {
    setInput(text);
    taRef.current?.focus();
  }

  return (
    <div className="client-ai">
      <ClientNavbar />
      <div className="client-ai__layout">
        <aside className={`client-ai__sidebar${sidebarOpen || !isMobile ? ' is-open' : ''}`}>
          <div className="client-ai__sidebar-head">
            <h2>Чаты</h2>
            <button type="button" className="button" onClick={createChat}>
              <Plus size={16} /> Новый
            </button>
          </div>
          <ul className="client-ai__chat-list">
            {[...chats]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`client-ai__chat-row${c.id === activeId ? ' is-active' : ''}`}
                    onClick={() => {
                      setActiveId(c.id);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className="client-ai__chat-title">{c.title || 'Без названия'}</span>
                    <span className="client-ai__chat-meta">{c.messages.length ? `${c.messages.length} сообщ.` : 'пусто'}</span>
                  </button>
                  <button type="button" className="client-ai__chat-del" title="Удалить" onClick={() => deleteChat(c.id)}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
          </ul>
        </aside>

        {isMobile && sidebarOpen && <button type="button" className="client-ai__scrim" aria-label="Закрыть" onClick={() => setSidebarOpen(false)} />}

        <main className="client-ai__main">
          <header className="client-ai__top">
            <div>
              {isMobile && (
                <button type="button" className="button secondary client-ai__menu-btn" onClick={() => setSidebarOpen(true)}>
                  Чаты
                </button>
              )}
              <p className="client-ai__eyebrow">Поддержка</p>
              <h1 className="client-ai__h1">ИИ-помощник</h1>
              <p className="client-ai__lead">Мягкая рефлексия. Не заменяет психолога.</p>
            </div>
          </header>

          <div className="client-ai__panel">
            <div className="client-ai__thread">
              {messages.length === 0 && (
                <div className="client-ai__empty">
                  <Moon size={28} strokeWidth={1.5} />
                  <h2>Начните диалог</h2>
                  <p>Можно описать настроение или попросить помочь сформулировать мысль к сессии.</p>
                  <div className="client-ai__chips">
                    {PROMPT_CHIPS.map((chip) => (
                      <button key={chip} type="button" className="client-ai__chip" onClick={() => applyChip(chip)}>
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.length > 0 && !disclaimerShown && (
                <div className="client-ai__disclaimer">
                  ИИ не ставит диагнозов и не заменяет терапию.
                  <button type="button" onClick={() => setDisclaimerShown(true)}>
                    Понятно
                  </button>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={`${activeId}-${idx}`} className={`client-ai__bubble-row client-ai__bubble-row--${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <span className="client-ai__bot" aria-hidden>
                      <Moon size={16} />
                    </span>
                  )}
                  <div className={`client-ai__bubble client-ai__bubble--${msg.role}`}>{msg.content}</div>
                </div>
              ))}
              {loading && (
                <div className="client-ai__bubble-row client-ai__bubble-row--assistant">
                  <span className="client-ai__bot" aria-hidden>
                    <Moon size={16} />
                  </span>
                  <div className="client-ai__bubble client-ai__bubble--assistant client-ai__bubble--typing">Печатаю…</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form className="client-ai__composer" onSubmit={(e) => void onSubmit(e)}>
              <textarea
                ref={taRef}
                value={input}
                rows={1}
                placeholder={token ? 'Спросите о настроении, сессии, формулировке…' : 'Войдите, чтобы писать'}
                disabled={loading || !token}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onSubmit();
                  }
                }}
              />
              <button type="submit" className="client-ai__send" disabled={loading || !input.trim() || !token} aria-label="Отправить">
                <Send size={18} />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
