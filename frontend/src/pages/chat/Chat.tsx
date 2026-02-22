import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { io, Socket } from 'socket.io-client';

interface ChatRoom {
  id: string;
  name: string | null;
  psychologistId: string;
  clientId: string;
  client?: {
    id: string;
    name: string;
    email: string | null;
    avatarUrl?: string | null;
    displayName?: string;
  };
  psychologist?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  messages?: Array<{
    content: string;
    createdAt: string;
    authorId: string;
  }>;
}

interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export default function ChatPage() {
  const { token, user } = useAuth();
  const isClient = user?.role === 'client';
  const isPsychologist = user?.role === 'psychologist' || user?.role === 'admin';
  
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Проверка верификации для психологов
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

  // Загрузка комнат
  useEffect(() => {
    if (isPsychologist && isVerified === false) return;
    if (!token) return;
    
    loadRooms();
  }, [token, isClient, isPsychologist, isVerified]);

  // Автоматический выбор комнаты для клиента
  useEffect(() => {
    if (isClient && rooms.length > 0 && !currentRoomId) {
      setCurrentRoomId(rooms[0].id);
    }
  }, [isClient, rooms, currentRoomId]);

  // Подключение к Socket.io для real-time обновлений
  useEffect(() => {
    if (!token || !user) return;

    const env = (import.meta as any).env || {};
    const apiUrl = env.VITE_API_ORIGIN || env.VITE_API_URL || window.location.origin;
    
    const socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      }
    });

    socketRef.current = socket;

    // Слушаем новые сообщения
    socket.on('new-message', (message: ChatMessage) => {
      if (message.roomId === currentRoomId) {
        setMessages(prev => {
          // Проверяем, нет ли уже такого сообщения (избегаем дубликатов)
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        
        // Обновляем список комнат для показа последнего сообщения
        setRooms(prev => prev.map(room => 
          room.id === message.roomId 
            ? { ...room, messages: [{ content: message.content, createdAt: message.createdAt, authorId: message.authorId }] }
            : room
        ));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user, currentRoomId]);

  // Присоединение к комнате через Socket.io
  useEffect(() => {
    if (socketRef.current && currentRoomId && user) {
      socketRef.current.emit('join-chat-room', {
        roomId: currentRoomId,
        userId: user.id
      });
    }

    return () => {
      if (socketRef.current && currentRoomId) {
        socketRef.current.emit('leave-chat-room', {
          roomId: currentRoomId
        });
      }
    };
  }, [currentRoomId, user]);

  // Загрузка сообщений при смене комнаты
  useEffect(() => {
    if (currentRoomId) {
      loadMessages(currentRoomId);
    } else {
      setMessages([]);
    }
  }, [currentRoomId, token]);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        messagesContainerRef.current?.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [messages]);

  // Автоизменение размера textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  async function loadRooms() {
    if (!token) return;
    
    try {
      const res = await api<{ items: ChatRoom[] }>('/api/chat/rooms', { token });
      setRooms(res.items || []);
      
      // Если комната не выбрана и есть комнаты, выбираем первую
      if (!currentRoomId && res.items && res.items.length > 0) {
        setCurrentRoomId(res.items[0].id);
      }
    } catch (e: any) {
      // Игнорируем ошибки
    }
  }

  async function loadMessages(roomId: string) {
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await api<{ items: ChatMessage[] }>(`/api/chat/rooms/${roomId}/messages`, { token });
      setMessages(res.items || []);
      
      // Отмечаем как прочитанную
      const now = new Date();
      const roomViews = JSON.parse(localStorage.getItem('chat_room_views') || '{}');
      roomViews[roomId] = now.toISOString();
      localStorage.setItem('chat_room_views', JSON.stringify(roomViews));
      
      try {
        await api(`/api/chat/rooms/${roomId}/read`, { method: 'POST', token });
      } catch (e) {
        // Игнорируем ошибки
      }
      
      window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { roomId } }));
    } catch (e: any) {
      // Игнорируем ошибки
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRoomId || !content.trim() || sending) return;
    
    setSending(true);
    const messageContent = content.trim();
    setContent('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    
    // Оптимистичное обновление
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      roomId: currentRoomId,
      authorId: user?.id || '',
      content: messageContent,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      await api(`/api/chat/rooms/${currentRoomId}/messages`, {
        method: 'POST',
        token: token ?? undefined,
        body: { content: messageContent }
      });
      
      // Обновляем время просмотра
      const now = new Date();
      const roomViews = JSON.parse(localStorage.getItem('chat_room_views') || '{}');
      roomViews[currentRoomId] = now.toISOString();
      localStorage.setItem('chat_room_views', JSON.stringify(roomViews));
      
      window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { roomId: currentRoomId } }));
      
      // Перезагружаем сообщения
      await loadMessages(currentRoomId);
      await loadRooms();
    } catch (e: any) {
      // Удаляем оптимистичное сообщение при ошибке
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
    } finally {
      setSending(false);
    }
  }

  function getAvatarUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const env = (import.meta as any).env || {};
    let baseOrigin = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
    if (!baseOrigin && typeof window !== 'undefined') {
      baseOrigin = window.location.origin;
    }
    return `${baseOrigin}${url}`;
  }

  function getRoomName(room: ChatRoom): string {
    if (isClient) {
      return room.psychologist?.name || 'Психолог';
    }
    return room.client?.displayName || room.client?.name || room.name || 'Клиент';
  }

  function getRoomAvatar(room: ChatRoom): string | null {
    if (isClient) {
      return room.psychologist?.avatarUrl || null;
    }
    return room.client?.avatarUrl || null;
  }

  const currentRoom = rooms.find(r => r.id === currentRoomId);

  // Показываем требование верификации для психологов
  if (isPsychologist && token && isVerified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <UniversalNavbar />
      
      <main style={{ 
        flex: 1, 
        padding: 0, 
        maxWidth: '100%', 
        display: 'flex', 
        background: 'var(--bg)',
        height: 'calc(100vh - 80px)'
      }}>
        {/* Боковая панель со списком чатов */}
        <div style={{ 
          width: 320,
          background: 'var(--surface-2)', 
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* Заголовок */}
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', 
            alignItems: 'center', 
            gap: 12
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))' }} />
            <b style={{ fontSize: 16, fontWeight: 700 }}>{isClient ? 'Мой психолог' : 'Сообщения'}</b>
          </div>
          
          {/* Список чатов */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            padding: '8px'
          }}>
            {rooms.map(room => {
              const isActive = room.id === currentRoomId;
              const lastMessage = room.messages?.[0];
              const roomName = getRoomName(room);
              const avatarUrl = getRoomAvatar(room);
              
              return (
                <button
                  key={room.id}
                  onClick={() => setCurrentRoomId(room.id)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    background: isActive ? 'rgba(91, 124, 250, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: 12,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    marginBottom: 2,
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={getAvatarUrl(avatarUrl) || undefined}
                      alt={roomName}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(255,255,255,0.1)',
                        flexShrink: 0
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.avatar-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'avatar-fallback';
                          fallback.style.cssText = 'width: 48px; height: 48px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800; font-size: 18px; flex-shrink: 0;';
                          fallback.textContent = roomName.charAt(0).toUpperCase();
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      color: '#0b0f1a',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 18,
                      flexShrink: 0
                    }}>
                      {roomName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: 15, 
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {roomName}
                    </div>
                    {lastMessage && (
                      <div style={{ 
                        color: 'var(--text-muted)', 
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {lastMessage.content}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            
            {rooms.length === 0 && (
              <div style={{ 
                padding: '40px 20px', 
                textAlign: 'center', 
                color: 'var(--text-muted)',
                fontSize: 14
              }}>
                {isClient ? 'Психолог не назначен' : 'Нет клиентов'}
              </div>
            )}
          </div>
        </div>

        {/* Область чата */}
        <div style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          minWidth: 0
        }}>
          {currentRoom ? (
            <>
              {/* Заголовок чата */}
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', 
                alignItems: 'center', 
                gap: 12,
                background: 'var(--surface-2)',
                flexShrink: 0
              }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {getRoomName(currentRoom)}
                </div>
              </div>
              
              {/* Сообщения */}
              <div
                ref={messagesContainerRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  scrollBehavior: 'smooth'
                }}
              >
                {loading && (
                  <div style={{ 
                    textAlign: 'center', 
                    color: 'var(--text-muted)', 
                    padding: '20px',
                    fontSize: 14
                  }}>
                    Загрузка сообщений...
                  </div>
                )}
                
                {!loading && messages.length === 0 && (
                  <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 15,
                    gap: 12
                  }}>
                    <div style={{ fontSize: 48, opacity: 0.5 }}>✉️</div>
                    <div>Нет сообщений. Начните общение!</div>
                  </div>
                )}
                
                {messages.map((message, idx) => {
                  const isMine = message.authorId === user?.id;
                  const prevMessage = idx > 0 ? messages[idx - 1] : null;
                  const isGrouped = prevMessage && 
                    prevMessage.authorId === message.authorId && 
                    new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 300000;
                  
                  return (
                    <div
                      key={message.id}
                      style={{
                        display: 'flex',
                        justifyContent: isMine ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        gap: 8,
                        padding: isGrouped ? '1px 0' : '4px 0',
                        marginTop: isGrouped ? 0 : 4
                      }}
                    >
                      {!isMine && (
                        <div style={{
                          width: isGrouped ? 0 : 32,
                          height: isGrouped ? 0 : 32,
                          borderRadius: 999,
                          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                          color: '#0b0f1a',
                          display: isGrouped ? 'none' : 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: 14,
                          flexShrink: 0
                        }}>
                          {getRoomName(currentRoom).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{
                        maxWidth: '65%',
                        minWidth: '80px',
                        background: isMine
                          ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                          : 'var(--surface-2)',
                        color: isMine ? '#0b0f1a' : 'var(--text)',
                        borderRadius: isMine
                          ? (isGrouped ? '18px 18px 4px 18px' : '18px 18px 4px 18px')
                          : (isGrouped ? '18px 18px 18px 4px' : '18px 18px 18px 4px'),
                        padding: '10px 14px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 15,
                        lineHeight: 1.4,
                        boxShadow: isMine ? '0 2px 8px rgba(91, 124, 250, 0.25)' : '0 1px 2px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ marginBottom: 2 }}>{message.content}</div>
                        <div style={{
                          fontSize: 11,
                          opacity: isMine ? 0.75 : 0.55,
                          textAlign: 'right',
                          marginTop: 4,
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMine && <span style={{ fontSize: 13 }}>✓</span>}
                        </div>
                      </div>
                      {isMine && <div style={{ width: isGrouped ? 0 : 32, flexShrink: 0 }} />}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Поле ввода */}
              <form
                onSubmit={sendMessage}
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  flexShrink: 0
                }}
              >
                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    ref={textareaRef}
                    placeholder="Напишите сообщение..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e as any);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 24,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 15,
                      fontFamily: 'inherit',
                      resize: 'none',
                      minHeight: 44,
                      maxHeight: 120,
                      lineHeight: 1.4,
                      outline: 'none',
                      overflow: 'hidden'
                    }}
                    rows={1}
                  />
                </div>
                <button
                  className="button"
                  type="submit"
                  disabled={!content.trim() || sending}
                  style={{
                    padding: '12px 24px',
                    fontSize: 15,
                    fontWeight: 600,
                    borderRadius: 24,
                    minWidth: 100,
                    flexShrink: 0
                  }}
                >
                  {sending ? 'Отправка…' : 'Отправить'}
                </button>
              </form>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 15,
              gap: 12
            }}>
              <div style={{ fontSize: 48, opacity: 0.5 }}>💬</div>
              <div>Выберите чат из списка слева</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
