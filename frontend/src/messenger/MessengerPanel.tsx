import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronLeft, Plus, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChatSocket } from '../context/ChatSocketContext';
import { api } from '../lib/api';
import {
  formatListTime,
  formatMsgTime,
  resolveAvatarUrl,
  type ChatMessageItem,
  type ChatRoomItem
} from './types';
import './Messenger.css';

type Mode = 'drawer' | 'full';

type Props = {
  mode: Mode;
  initialRoomId?: string | null;
  initialClientName?: string | null;
  /** Черновик в поле ввода (например, мысль дня) */
  initialDraft?: string | null;
  onRoomChange?: (roomId: string | null) => void;
  onClose?: () => void;
};

export function MessengerPanel({
  mode,
  initialRoomId = null,
  initialClientName = null,
  initialDraft = null,
  onRoomChange,
  onClose
}: Props) {
  const { token, user } = useAuth();
  const {
    unread,
    onlineUsers,
    subscribeRoom,
    unsubscribeRoom,
    sendMessage,
    markRead,
    onMessage,
    onAck,
    onReadReceipt
  } = useChatSocket();

  const isClient = user?.role === 'client';
  const isPsych = user?.role === 'psychologist' || user?.role === 'admin';

  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [current, setCurrent] = useState<string | null>(initialRoomId);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [content, setContent] = useState(initialDraft?.trim() || '');
  const [query, setQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [showThread, setShowThread] = useState(Boolean(initialRoomId));
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const handledClientName = useRef<string | null>(null);
  const draftApplied = useRef(false);
  const stackMode = mode === 'drawer' || isMobile;

  const currentRoom = useMemo(() => rooms.find((r) => r.id === current) || null, [rooms, current]);

  async function loadRooms() {
    if (!token) return [] as ChatRoomItem[];
    try {
      const res = await api<{ items: ChatRoomItem[] }>('/api/chat/rooms', { token });
      const items = res.items || [];
      setRooms(items);
      return items;
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить чаты');
      return [];
    }
  }

  async function loadClients() {
    if (!token || isClient) return;
    try {
      const res = await api<{ items: any[] }>('/api/clients', { token });
      setClients(res.items || []);
    } catch {
      setClients([]);
    }
  }

  async function loadMessages(id: string) {
    if (!token || !id) return;
    setLoadingMessages(true);
    try {
      const res = await api<{ items: ChatMessageItem[] }>(`/api/chat/rooms/${id}/messages`, { token });
      setMessages(res.items || []);
      markRead(id);
      await api(`/api/chat/rooms/${id}/read`, { method: 'POST', token }).catch(() => undefined);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить сообщения');
    } finally {
      setLoadingMessages(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    }
  }

  function selectRoom(id: string | null) {
    setCurrent(id);
    onRoomChange?.(id);
    if (id) setShowThread(true);
  }

  async function ensureRoomForClient(client: { id?: string; name?: string }) {
    const clientName = client.name || client.id;
    if (!clientName || !token) return;
    const key = String(clientName).trim().toLowerCase();
    const fresh = await loadRooms();
    const byName = fresh.find((r) => {
      const n = (r.name || '').trim().toLowerCase();
      const d = (r.displayName || '').trim().toLowerCase();
      return n === key || d === key;
    });
    if (byName) {
      selectRoom(byName.id);
      setShowNewChat(false);
      return;
    }
    try {
      const created = await api<{ id: string; created?: boolean }>('/api/chat/rooms', {
        method: 'POST',
        token,
        body: { name: String(clientName).trim() }
      });
      await loadRooms();
      if (created?.id) selectRoom(created.id);
      setShowNewChat(false);
    } catch (e: any) {
      setError(e.message || 'Не удалось открыть чат');
    }
  }

  function submitMessage() {
    if (!current || !content.trim() || !user?.id) return;
    const text = content.trim();
    const clientMessageId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [
      ...prev,
      {
        id: clientMessageId,
        roomId: current,
        authorId: user.id,
        content: text,
        createdAt: new Date().toISOString(),
        pending: true,
        clientMessageId
      }
    ]);
    setContent('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    sendMessage(current, text, clientMessageId);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
  }

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    void loadRooms();
    void loadClients();
  }, [token, isClient]);

  useEffect(() => {
    if (!initialRoomId) return;
    setCurrent(initialRoomId);
    setShowThread(true);
    onRoomChange?.(initialRoomId);
  }, [initialRoomId]);

  // Черновик из «Обсудить» / мысль дня: открыть первый чат и подставить текст
  useEffect(() => {
    const draft = initialDraft?.trim();
    if (!draft || draftApplied.current) return;
    if (!rooms.length && !current) return;
    draftApplied.current = true;
    setContent(draft);
    if (!current && rooms[0]) {
      setCurrent(rooms[0].id);
      setShowThread(true);
      onRoomChange?.(rooms[0].id);
    }
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    });
  }, [initialDraft, rooms, current, onRoomChange]);

  useEffect(() => {
    if (!initialClientName || handledClientName.current === initialClientName) return;
    handledClientName.current = initialClientName;
    void (async () => {
      const list = rooms.length ? rooms : await loadRooms();
      const hit = list.find(
        (r) => (r.name || '').trim().toLowerCase() === initialClientName.trim().toLowerCase()
      );
      if (hit) {
        setCurrent(hit.id);
        setShowThread(true);
        onRoomChange?.(hit.id);
      } else {
        await ensureRoomForClient({ name: initialClientName });
      }
    })();
  }, [initialClientName]);

  useEffect(() => {
    if (!current) {
      setMessages([]);
      return;
    }
    subscribeRoom(current);
    void loadMessages(current);
    return () => unsubscribeRoom(current);
  }, [current, token]);

  useEffect(() => {
    const offMsg = onMessage((msg) => {
      if (!msg?.roomId) return;
      void loadRooms();
      if (msg.roomId !== current) return;
      setMessages((prev) => {
        if (
          prev.some(
            (m) => m.id === msg.id || (msg.clientMessageId && m.clientMessageId === msg.clientMessageId)
          )
        ) {
          return prev.map((m) =>
            msg.clientMessageId && m.clientMessageId === msg.clientMessageId
              ? { ...msg, pending: false }
              : m.id === msg.id
                ? { ...m, ...msg, pending: false }
                : m
          );
        }
        return [...prev, { ...msg, pending: false }];
      });
      if (msg.authorId !== user?.id) markRead(msg.roomId);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    });
    const offAck = onAck(({ clientMessageId, message }) => {
      if (!message || message.roomId !== current) return;
      setMessages((prev) => {
        const withoutTmp = prev.filter(
          (m) => !(clientMessageId && m.clientMessageId === clientMessageId) && m.id !== message.id
        );
        return [...withoutTmp, { ...message, pending: false, clientMessageId }];
      });
      void loadRooms();
    });
    const offRead = onReadReceipt(({ roomId, messageIds, readAt }) => {
      if (roomId !== current) return;
      const idSet = new Set(messageIds || []);
      // Only messages listed by server (authorId != reader) — never rewrite on author re-open
      setMessages((prev) => prev.map((m) => (idSet.has(m.id) ? { ...m, readAt } : m)));
    });
    return () => {
      offMsg();
      offAck();
      offRead();
    };
  }, [current, user?.id, onMessage, onAck, onReadReceipt, markRead]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [content]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withLive = rooms.map((r) => ({
      ...r,
      unreadCount: unread.byRoom[r.id] ?? r.unreadCount ?? 0,
      peerOnline: r.peerUserId
        ? onlineUsers.has(r.peerUserId) || Boolean(r.peerOnline)
        : Boolean(r.peerOnline)
    }));
    if (!q) return withLive;
    return withLive.filter((r) =>
      String(r.displayName || r.name || '')
        .toLowerCase()
        .includes(q)
    );
  }, [rooms, query, unread.byRoom, onlineUsers]);

  const filteredClients = useMemo(() => {
    const q = modalQuery.trim().toLowerCase();
    return (clients || []).filter((c) => String(c.name || '').toLowerCase().includes(q));
  }, [clients, modalQuery]);

  const listVisible = !stackMode || !showThread || !current;
  const threadVisible = Boolean(current) && (!stackMode || showThread);

  const peerOnline =
    Boolean(currentRoom?.peerOnline) ||
    Boolean(currentRoom?.peerUserId && onlineUsers.has(currentRoom.peerUserId));

  function goBackToList() {
    setShowThread(false);
    setCurrent(null);
    onRoomChange?.(null);
  }

  return (
    <div className={`msg msg--${mode}`}>
      <div className="msg__shell" style={stackMode ? { gridTemplateColumns: '1fr' } : undefined}>
        <aside
          className="msg__sidebar"
          data-tour="messages-sidebar"
          style={listVisible ? undefined : { display: 'none' }}
        >
          <div className="msg__sidebar-head">
            <h2 className="msg__sidebar-title">Сообщения</h2>
            {isPsych ? (
              <button
                type="button"
                className="msg__icon-btn"
                title="Новый чат"
                aria-label="Новый чат"
                onClick={() => {
                  setModalQuery('');
                  setShowNewChat(true);
                }}
              >
                <Plus size={18} />
              </button>
            ) : null}
            {mode === 'drawer' && onClose ? (
              <button
                type="button"
                className="msg__icon-btn msg__icon-btn--ghost"
                onClick={onClose}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
          <div className="msg__search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск"
              aria-label="Поиск чатов"
            />
          </div>
          <div className="msg__list">
            {filteredRooms.map((r) => {
              const label = r.displayName || r.name || 'Чат';
              const avatar = resolveAvatarUrl(r.peerAvatarUrl);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`msg__row${r.id === current ? ' is-active' : ''}`}
                  onClick={() => selectRoom(r.id)}
                >
                  <div className="msg__avatar">
                    {avatar ? <img src={avatar} alt="" /> : String(label).charAt(0).toUpperCase()}
                    {r.peerOnline ? <span className="msg__online" /> : null}
                  </div>
                  <div className="msg__row-meta">
                    <div className="msg__row-top">
                      <span className="msg__row-name">{label}</span>
                      <span className="msg__row-time">{formatListTime(r.lastMessage?.createdAt)}</span>
                    </div>
                    <div className="msg__row-bottom">
                      <span className="msg__row-preview">{r.lastMessage?.content || 'Нет сообщений'}</span>
                      {(r.unreadCount || 0) > 0 ? (
                        <span className="msg__badge">
                          {(r.unreadCount || 0) > 99 ? '99+' : r.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
            {!filteredRooms.length ? (
              <div className="msg__empty">
                {isClient
                  ? 'Пока нет чатов. Напишите специалисту из каталога.'
                  : 'Нет чатов. Нажмите +, чтобы начать.'}
              </div>
            ) : null}
          </div>
        </aside>

        <section
          className="msg__thread"
          data-tour="messages-main"
          style={threadVisible || (!stackMode && !current) ? undefined : { display: 'none' }}
        >
          {current ? (
            <>
              <div className="msg__chrome">
                <button type="button" className="msg__back-chats" onClick={goBackToList}>
                  <ChevronLeft size={18} />
                  <span>назад</span>
                </button>
                <div className="msg__thread-name">
                  {peerOnline ? <span className="msg__online-dot" title="В сети" /> : null}
                  <span>{currentRoom?.displayName || currentRoom?.name || 'Чат'}</span>
                </div>
              </div>
              <div className="msg__messages">
                {loadingMessages ? <div className="msg__empty">Загрузка…</div> : null}
                {!loadingMessages && messages.length === 0 ? (
                  <div className="msg__empty">Нет сообщений. Начните общение.</div>
                ) : null}
                {messages.map((m) => {
                  const mine = m.authorId === user?.id;
                  const read = Boolean(m.readAt);
                  return (
                    <div key={m.id} className={`msg__bubble-row ${mine ? 'is-mine' : 'is-theirs'}`}>
                      <div className={`msg__bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
                        <div>{m.content}</div>
                        <div className="msg__bubble-meta">
                          <span>{formatMsgTime(m.createdAt)}</span>
                          {mine ? (
                            <span
                              className={`msg__ticks${read ? ' is-read' : ''}`}
                              title={read ? 'Прочитано' : 'Доставлено'}
                            >
                              {read ? <CheckCheck size={14} strokeWidth={2.25} /> : <Check size={14} strokeWidth={2.25} />}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form
                className="msg__composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitMessage();
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={content}
                  placeholder="Сообщение"
                  rows={1}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitMessage();
                    }
                  }}
                />
                <button type="submit" className="msg__send" disabled={!content.trim()} aria-label="Отправить">
                  <Send size={18} strokeWidth={2.25} className="msg__send-icon" aria-hidden />
                </button>
              </form>
            </>
          ) : (
            <div className="msg__placeholder">Выберите чат, чтобы начать переписку</div>
          )}
        </section>
      </div>

      {error ? (
        <div className="msg__empty" style={{ color: '#b42318' }}>
          {error}
        </div>
      ) : null}

      {showNewChat ? (
        <div className="msg__modal-backdrop" onClick={() => setShowNewChat(false)}>
          <div className="msg__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Новый чат">
            <div className="msg__modal-head">
              <span>Новый чат</span>
              <button
                type="button"
                className="msg__icon-btn msg__icon-btn--ghost"
                onClick={() => setShowNewChat(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="msg__search">
              <input
                value={modalQuery}
                onChange={(e) => setModalQuery(e.target.value)}
                placeholder="Найти клиента"
                autoFocus
              />
            </div>
            <div className="msg__modal-body">
              {filteredClients.map((c) => (
                <button key={c.id} type="button" className="msg__row" onClick={() => void ensureRoomForClient(c)}>
                  <div className="msg__avatar">{String(c.name || '?').charAt(0).toUpperCase()}</div>
                  <div className="msg__row-meta">
                    <div className="msg__row-name">{c.name || 'Клиент'}</div>
                    <div className="msg__row-preview">{c.email || ''}</div>
                  </div>
                </button>
              ))}
              {!filteredClients.length ? <div className="msg__empty">Клиенты не найдены</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
