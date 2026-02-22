import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import '../../styles/tokens.css';

type ChatRoom = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  createdAt: string;
};

type Client = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
};

type Psychologist = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
};

export default function ChatPage() {
  const { token, user } = useAuth();
  const isClient = user?.role === 'client';
  const isPsychologist = user?.role === 'psychologist' || user?.role === 'admin';
  
  // State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [psychologist, setPsychologist] = useState<Psychologist | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Получить URL аватара
  const getAvatarUrl = (url: string | null | undefined, userId?: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const env = (import.meta as any).env || {};
    let baseOrigin = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
    if (!baseOrigin && typeof window !== 'undefined') {
      baseOrigin = window.location.origin;
    }
    const separator = url.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    params.set('t', Date.now().toString());
    return `${baseOrigin}${url}${separator}${params.toString()}`;
  };

  // Загрузить комнаты
  async function loadRooms() {
    if (!token) {
      console.log('[Chat] loadRooms: No token');
      return;
    }
    try {
      console.log('[Chat] loadRooms: Fetching rooms...');
      const res = await api<{ items: ChatRoom[] }>('/api/chat/rooms', { token });
      // Backend уже фильтрует комнаты правильно, поэтому просто используем то, что пришло
      const roomsList = res.items || [];
      console.log('[Chat] loadRooms: Received rooms from API:', roomsList);
      console.log('[Chat] loadRooms: Setting rooms state with', roomsList.length, 'rooms');
      setRooms(roomsList);
      return roomsList;
    } catch (e: any) {
      console.error('[Chat] loadRooms: Failed to load rooms:', e);
      return [];
    }
  }

  // Загрузить клиентов (для психолога)
  async function loadClients() {
    if (!token || !isPsychologist) return [];
    try {
      const res = await api<{ items: Client[] }>('/api/clients', { token });
      setClients(res.items || []);
      return res.items || [];
    } catch (e: any) {
      console.error('Failed to load clients:', e);
      setClients([]);
      return [];
    }
  }

  // Загрузить психолога (для клиента)
  async function loadPsychologist() {
    if (!token || !isClient) return;
    try {
      const psych = await api<Psychologist>('/api/clients/my-psychologist', { token });
      setPsychologist(psych);
    } catch (e: any) {
      console.error('Failed to load psychologist:', e);
      setPsychologist(null);
    }
  }

  // Загрузить сообщения
  async function loadMessages(roomId: string) {
    if (!token || !roomId) return;
    setLoadingMessages(true);
    try {
      const res = await api<{ items: ChatMessage[] }>(`/api/chat/rooms/${roomId}/messages`, { token });
      setMessages(res.items || []);
      
      // Отметить как прочитанное
      const roomViews = JSON.parse(localStorage.getItem('chat_room_views') || '{}');
      roomViews[roomId] = new Date().toISOString();
      localStorage.setItem('chat_room_views', JSON.stringify(roomViews));
      
      try {
        await api(`/api/chat/rooms/${roomId}/read`, { method: 'POST', token });
      } catch (e) {
        // Игнорируем ошибки
      }
      
      window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { roomId } }));
    } catch (e: any) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  }

  // Отправить сообщение
  async function sendMessage() {
    if (!token || !currentRoomId || !inputText.trim() || sending) return;
    
    const content = inputText.trim();
    setInputText('');
    setSending(true);
    
    try {
      const newMessage = await api<ChatMessage>(`/api/chat/rooms/${currentRoomId}/messages`, {
        method: 'POST',
        token,
        body: { content }
      });
      
      setMessages(prev => [...prev, newMessage]);
      await loadRooms(); // Обновить список комнат
    } catch (e: any) {
      console.error('Failed to send message:', e);
      setInputText(content); // Вернуть текст при ошибке
    } finally {
      setSending(false);
    }
  }



  // Проверка верификации
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

  // Инициализация
  useEffect(() => {
    if (isPsychologist && isVerified === false) return;
    
    if (isPsychologist) {
      // Для психолога: сначала загружаем клиентов, потом комнаты (чтобы фильтрация работала)
      loadClients().then(() => {
        loadRooms();
      });
    } else if (isClient) {
      loadPsychologist();
      loadRooms();
    }
  }, [token, isClient, isPsychologist, isVerified]);

  // Автоматическое открытие чата для клиента
  useEffect(() => {
    if (isClient && psychologist && rooms.length > 0 && !currentRoomId) {
      const clientProfile = async () => {
        try {
          const profile = await api<any>('/api/client/profile', { token: token ?? undefined });
          const clientName = profile?.client?.name || profile?.profile?.name || user?.email?.split('@')[0] || 'Клиент';
          
          const existingRoom = rooms.find(r => {
            const roomName = r.name.toLowerCase();
            const nameLower = clientName.toLowerCase();
            return roomName === nameLower || roomName.includes(nameLower) || nameLower.includes(roomName);
          });
          
          if (existingRoom) {
            setCurrentRoomId(existingRoom.id);
            await loadMessages(existingRoom.id);
          } else {
            // Создать комнату
            try {
              const created = await api<ChatRoom>('/api/chat/rooms', {
                method: 'POST',
                token: token ?? undefined,
                body: { name: clientName }
              });
              await loadRooms();
              setCurrentRoomId(created.id);
              await loadMessages(created.id);
            } catch (e) {
              console.error('Failed to create room:', e);
            }
          }
        } catch (e) {
          console.error('Failed to load profile:', e);
        }
      };
      
      clientProfile();
    }
  }, [isClient, psychologist, rooms, currentRoomId, token, user]);

  // Загрузка сообщений при смене комнаты
  useEffect(() => {
    if (currentRoomId) {
      loadMessages(currentRoomId);
    }
  }, [currentRoomId, token]);

  // Автопрокрутка к новым сообщениям
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
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
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Форматирование времени
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  // Получить имя собеседника
  const getChatName = (room: ChatRoom) => {
    if (isClient) {
      return psychologist?.name || 'Психолог';
    }
    return room.name;
  };

  // Получить аватар собеседника
  const getChatAvatar = (room: ChatRoom) => {
    if (isClient) {
      return psychologist?.avatarUrl ? getAvatarUrl(psychologist.avatarUrl, psychologist.id) : null;
    }
    const client = clients.find(c => c.name === room.name);
    return client?.avatarUrl ? getAvatarUrl(client.avatarUrl, client.id) : null;
  };

  // Фильтрация комнат по поиску
  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true;
    const name = getChatName(room).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });
  
  // Отладочное логирование
  console.log('[Chat] Rooms state:', rooms);
  console.log('[Chat] Filtered rooms:', filteredRooms);
  console.log('[Chat] Clients:', clients);
  console.log('[Chat] Current room ID:', currentRoomId);

  // Показать требование верификации
  if (isPsychologist && isVerified === false && token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const currentChatName = currentRoom ? getChatName(currentRoom) : '';
  const currentChatAvatar = currentRoom ? getChatAvatar(currentRoom) : null;

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--background)'
    }}>
      {isPsychologist ? <PsychologistNavbar /> : <UniversalNavbar />}
      
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        overflow: 'hidden',
        height: 'calc(100vh - 60px)'
      }}>
        {/* Список чатов (левая панель) */}
        <div style={{
          width: 350,
          borderRight: '1px solid rgba(255,255,255,0.08)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Заголовок и поиск */}
          <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 700 }}>
              {isClient ? 'Чат' : 'Чаты'}
            </h2>
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>

          {/* Список чатов */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isClient ? (
              // Для клиента - один чат с психологом
              currentRoom ? (
                <div
                  onClick={() => {
                    setCurrentRoomId(currentRoom.id);
                    loadMessages(currentRoom.id);
                  }}
                  style={{
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    background: currentRoomId === currentRoom.id ? 'var(--surface-2)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentRoomId !== currentRoom.id) {
                      e.currentTarget.style.background = 'var(--surface-2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentRoomId !== currentRoom.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: currentChatAvatar 
                      ? 'transparent' 
                      : 'linear-gradient(135deg, var(--primary), var(--accent))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {currentChatAvatar ? (
                      <img 
                        src={currentChatAvatar} 
                        alt={currentChatName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 20, color: '#fff' }}>
                        {currentChatName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                      {currentChatName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {messages.length > 0 
                        ? messages[messages.length - 1].content.substring(0, 30) + '...'
                        : 'Нет сообщений'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Загрузка чата...
                </div>
              )
            ) : (
              // Для психолога - список клиентов
              rooms.length > 0 ? (
                filteredRooms.map(room => {
                  const client = clients.find(c => c.name === room.name);
                  const avatar = client?.avatarUrl ? getAvatarUrl(client.avatarUrl, client.id) : null;
                  
                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setCurrentRoomId(room.id);
                        loadMessages(room.id);
                      }}
                      style={{
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        background: currentRoomId === room.id ? 'var(--surface-2)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentRoomId !== room.id) {
                          e.currentTarget.style.background = 'var(--surface-2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentRoomId !== room.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: avatar 
                          ? 'transparent' 
                          : 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {avatar ? (
                          <img 
                            src={avatar} 
                            alt={room.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: 20, color: '#fff' }}>
                            {room.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                          {room.name}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {messages.length > 0 && messages[messages.length - 1].roomId === room.id
                            ? messages[messages.length - 1].content.substring(0, 30) + '...'
                            : 'Нет сообщений'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {searchQuery ? 'Ничего не найдено' : 'Загрузка чатов...'}
                </div>
              )
            )}
          </div>
        </div>

        {/* Область чата (правая панель) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--background)',
          overflow: 'hidden'
        }}>
          {currentRoomId ? (
            <>
              {/* Заголовок чата */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: currentChatAvatar 
                    ? 'transparent' 
                    : 'linear-gradient(135deg, var(--primary), var(--accent))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {currentChatAvatar ? (
                    <img 
                      src={currentChatAvatar} 
                      alt={currentChatName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 18, color: '#fff' }}>
                      {currentChatName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {currentChatName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {isClient ? 'Психолог' : 'Клиент'}
                  </div>
                </div>
              </div>

              {/* Сообщения */}
              <div
                ref={messagesContainerRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    Загрузка сообщений...
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => {
                    const isOwn = msg.authorId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: isOwn ? 'flex-end' : 'flex-start',
                          alignItems: 'flex-end',
                          gap: 8
                        }}
                      >
                        {!isOwn && (
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: currentChatAvatar 
                              ? 'transparent' 
                              : 'linear-gradient(135deg, var(--primary), var(--accent))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}>
                            {currentChatAvatar ? (
                              <img 
                                src={currentChatAvatar} 
                                alt={currentChatName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: 14, color: '#fff' }}>
                                {currentChatName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{
                          maxWidth: '70%',
                          padding: '10px 14px',
                          borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                          background: isOwn
                            ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                            : 'var(--surface-2)',
                          color: isOwn ? '#fff' : 'var(--text)',
                          wordBreak: 'break-word',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          <div style={{ marginBottom: 4, lineHeight: 1.5 }}>
                            {msg.content}
                          </div>
                          <div style={{
                            fontSize: 11,
                            opacity: 0.7,
                            textAlign: 'right'
                          }}>
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    Нет сообщений. Начните общение!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Поле ввода */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'var(--surface)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-end'
              }}>
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Напишите сообщение..."
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'none',
                    maxHeight: 120,
                    minHeight: 40
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || sending}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: 'none',
                    background: inputText.trim() && !sending
                      ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                      : 'var(--surface-2)',
                    color: inputText.trim() && !sending ? '#fff' : 'var(--text-muted)',
                    cursor: inputText.trim() && !sending ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                >
                  {sending ? '⏳' : '➤'}
                </button>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              {isClient 
                ? 'Выберите чат для начала общения'
                : 'Выберите клиента для начала общения'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
