import React, { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { api, getApiBaseUrl } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';

export default function ChatPage() {
  const { token, user } = useAuth();
  const isClient = user?.role === 'client';
  const isPsychologist = user?.role === 'psychologist' || user?.role === 'admin';
  const [rooms, setRooms] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [psychologist, setPsychologist] = useState<any>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  // kept for future use (skeletons/spinners)
  // const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatScreen, setShowChatScreen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

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
    // Добавляем параметры для предотвращения кэширования и уникальности для каждого клиента
    const separator = url.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    params.set('t', Date.now().toString());
    return `${baseOrigin}${url}${separator}${params.toString()}`;
  };

  async function loadRooms() {
    // setLoadingRooms(true);
    try {
      const res = await api<{ items: any[] }>('/api/chat/rooms', { token: token ?? undefined });
      const roomsList = res.items || [];
      setRooms(roomsList);
      return roomsList; // Возвращаем список комнат для использования
      // Не устанавливаем автоматически первую комнату - пользователь должен выбрать чат сам
    } catch (e: any) { 
      setError(e.message || 'Failed to load rooms'); 
      return []; 
    } finally { /* setLoadingRooms(false); */ }
  }

  async function loadClients() {
    if (isClient) {
      // Для клиента загружаем только его психолога
      if (!token) return;
      try {
        const psych = await api<any>('/api/clients/my-psychologist', { token: token ?? undefined });
        setPsychologist(psych);
        // Комната будет открыта автоматически в useEffect после загрузки комнат
      } catch (e: any) {
        // Если психолог не найден, показываем сообщение
        setPsychologist(null);
      }
      return;
    }
    
    const demo: any[] = [
      { id: 'c1', name: 'Иван Петров', email: 'ivan@example.com' },
      { id: 'c2', name: 'Анна Смирнова', email: 'anna@example.com' },
      { id: 'c3', name: 'Мария Коваль', email: 'maria@example.com' },
      { id: 'c4', name: 'Алексей Волков', email: 'alexey@example.com' },
      { id: 'c5', name: 'Ольга Соколова', email: 'olga@example.com' },
    ];
    if (!token) { setClients(demo); return; }
    try {
      const res = await api<{ items: any[] }>('/api/clients', { token: token ?? undefined });
      const items = Array.isArray(res.items) && res.items.length > 0 ? res.items : demo;
      setClients(items);
    } catch {
      setClients(demo);
    }
  }

  async function loadMessages(id: string) {
    setLoadingMessages(true);
    try {
      const res = await api<{ items: any[] }>(`/api/chat/rooms/${id}/messages`, { token: token ?? undefined });
      setMessages(res.items || []);
      
      // Отмечаем комнату как просмотренную - сохраняем время для конкретной комнаты
      if (id) {
        const now = new Date();
        const roomViews = JSON.parse(localStorage.getItem('chat_room_views') || '{}');
        
        // Всегда обновляем время просмотра на текущий момент
        // Это означает, что все сообщения, созданные до этого момента, считаются прочитанными
        // Новые сообщения, созданные после этого времени, будут считаться непрочитанными
        roomViews[id] = now.toISOString();
        
        localStorage.setItem('chat_room_views', JSON.stringify(roomViews));
        
        // Также сохраняем общее время последнего просмотра
        localStorage.setItem('chat_last_viewed', now.toISOString());
        
        // Отправляем запрос на сервер для отметки как прочитанной
        try {
          await api(`/api/chat/rooms/${id}/read`, { method: 'POST', token: token ?? undefined });
        } catch (e) {
          // Игнорируем ошибки при отметке как прочитанной
        }
        
        // Сразу обновляем счетчик непрочитанных сообщений
        // Вызываем событие для обновления счетчика в MessagesBell
        window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { roomId: id } }));
      }
    } catch (e: any) { setError(e.message || 'Failed to load messages'); } finally { setLoadingMessages(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); }
  }

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

  useEffect(() => { 
    if (isPsychologist && isVerified === false) return;
    loadRooms();
    loadClients();
    
    // При загрузке страницы чата, если есть комнаты, но нет времени просмотра,
    // устанавливаем время просмотра для всех комнат на текущий момент
    // Это сбросит счетчик непрочитанных для уже существующих сообщений
    const initializeRoomViews = async () => {
      if (token) {
        try {
          const res = await api<{ items: any[] }>('/api/chat/rooms', { token: token ?? undefined });
          if (res.items && res.items.length > 0) {
            const roomViews = JSON.parse(localStorage.getItem('chat_room_views') || '{}');
            let updated = false;
            const now = new Date().toISOString();
            
            // Для каждой комнаты, которая еще не была просмотрена, устанавливаем время просмотра
            for (const room of res.items) {
              if (!roomViews[room.id]) {
                roomViews[room.id] = now;
                updated = true;
              }
            }
            
            if (updated) {
              localStorage.setItem('chat_room_views', JSON.stringify(roomViews));
              // Обновляем счетчик непрочитанных
              window.dispatchEvent(new CustomEvent('chat-room-opened'));
            }
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }
    };
    
    // Запускаем инициализацию с небольшой задержкой, чтобы комнаты успели загрузиться
    setTimeout(initializeRoomViews, 500);
  }, [token, isClient, isPsychologist, isVerified]);
  
  // После загрузки комнат и психолога автоматически открываем чат
  useEffect(() => {
    if (isClient && psychologist && rooms.length > 0 && !current) {
      // КРИТИЧНО: Используем имя клиента из client.name (такое же, как создает психолог и бэкенд)
      let clientName = user?.email?.split('@')[0] || 'Клиент';
      
      // Пытаемся получить имя клиента из профиля (КРИТИЧНО: используем client.name, а не profile.name)
      api<any>('/api/client/profile', { token: token ?? undefined })
        .then(clientProfile => {
          // КРИТИЧНО: Приоритет client.name - это то же имя, что используется на бэкенде
          if (clientProfile?.client?.name) {
            clientName = clientProfile.client.name;
          } else if (clientProfile?.profile?.name) {
            clientName = clientProfile.profile.name;
          }
          
          // Только точное совпадение имени комнаты с CRM client.name (без includes — иначе можно открыть чужой чат)
          const clientNameLower = clientName.trim().toLowerCase();
          const existingRoom = rooms.find(r => (r.name || '').trim().toLowerCase() === clientNameLower);
          
          if (existingRoom) {
            setCurrent(existingRoom.id);
            loadMessages(existingRoom.id);
          } else {
            // Если комнаты нет, создаем ее
            ensureRoomForPsychologist();
          }
        })
        .catch(() => {
          const clientNameLower = clientName.trim().toLowerCase();
          const existingRoom = rooms.find(r => (r.name || '').trim().toLowerCase() === clientNameLower);
          
          if (existingRoom) {
            setCurrent(existingRoom.id);
            loadMessages(existingRoom.id);
          } else {
            ensureRoomForPsychologist();
          }
        });
    }
  }, [rooms, psychologist, isClient, current, user, token]);
  
  useEffect(() => { if (current) loadMessages(current); }, [current, token]);

  // Доставка новых сообщений в реальном времени (комната Socket.IO `chat:{roomId}`, не путать с голосовыми комнатами)
  useEffect(() => {
    if (!token || !current) return;
    const base = getApiBaseUrl();
    const socket: Socket = io(base, {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io/'
    });
    const onConnect = () => {
      socket.emit('chat:subscribe', { roomId: current });
    };
    socket.on('connect', onConnect);
    socket.on('chat:message', (msg: { id: string; roomId: string; authorId: string; content: string; createdAt: string }) => {
      if (!msg || msg.roomId !== current) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return () => {
      socket.emit('chat:unsubscribe', { roomId: current });
      socket.off('connect', onConnect);
      socket.disconnect();
    };
  }, [token, current]);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Show chat screen on mobile when chat is selected
  useEffect(() => {
    if (isMobileView && current) {
      setShowChatScreen(true);
    } else if (!current) {
      setShowChatScreen(false);
    }
  }, [current, isMobileView]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  // Auto-scroll to bottom when new messages arrive
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

  async function ensureRoomForClient(client: any) {
    if (!client) return;
    const clientName = client.name || client.id;
    
    // Ищем комнату по точному совпадению имени (регистронезависимый)
    const byName = rooms.find(r => {
      const roomName = (r.name || '').trim().toLowerCase();
      const clientNameLower = String(clientName || '').trim().toLowerCase();
      return roomName === clientNameLower;
    });
    
    if (byName) { 
      setCurrent(byName.id); 
      setShowClientsModal(false);
      await loadMessages(byName.id);
      return; 
    }
    
    // Если комнаты нет, создаем ее
    try {
      const created = await api<any>('/api/chat/rooms', { method: 'POST', token: token ?? undefined, body: { name: clientName } });
      await loadRooms();
      setCurrent(created?.id || null);
      if (created?.id) {
        await loadMessages(created.id);
      }
      setShowClientsModal(false);
    } catch (e: any) { 
      setError(e.message || 'Failed to open chat'); 
    }
  }

  async function ensureRoomForPsychologist() {
    // КРИТИЧНО: Эта функция вызывается и для клиента, и для психолога
    // Для клиента: получаем client.name из профиля
    // Для психолога: получаем client.name выбранного клиента
    
    let clientName = user?.email?.split('@')[0] || 'Клиент';
    
    if (isClient) {
      // Для клиента: получаем client.name из профиля (то же, что используется на бэкенде)
      try {
        const clientProfile = await api<any>('/api/client/profile', { token: token ?? undefined });
        // КРИТИЧНО: Приоритет client.name - это то же имя, что используется на бэкенде
        if (clientProfile?.client?.name) {
          clientName = clientProfile.client.name;
        } else if (clientProfile?.profile?.name) {
          clientName = clientProfile.profile.name;
        }
      } catch (e) {
        // Если не удалось получить профиль, используем email
      }
    } else if (isPsychologist) {
      // Для психолога: эта функция не должна вызываться напрямую
      // Психолог выбирает клиента через ensureRoomForClient
      return;
    }
    
    const roomName = clientName.trim();
    
    // Перезагружаем комнаты перед поиском, чтобы убедиться, что у нас актуальный список
    const roomsList = await loadRooms();
    
    // Ищем существующую комнату (регистронезависимый поиск)
    const clientNameLower = clientName.trim().toLowerCase();
    const existingRoom = roomsList.find(r => (r.name || '').trim().toLowerCase() === clientNameLower);
    
    if (existingRoom) {
      setCurrent(existingRoom.id);
      await loadMessages(existingRoom.id);
      return;
    }
    
    // Если комнаты нет, создаем ее
    try {
      const created = await api<any>('/api/chat/rooms', { method: 'POST', token: token ?? undefined, body: { name: roomName } });
      await loadRooms(); // Обновляем список комнат
      setCurrent(created?.id || null);
      if (created?.id) {
        await loadMessages(created.id);
      }
    } catch (e: any) {
      setError(e.message || 'Не удалось открыть чат');
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault(); if (!current) return;
    if (!content || !content.trim()) return;
    setError(null);
    try {
      const optimistic = { id: `tmp-${Date.now()}`, authorId: user?.id, content, createdAt: new Date().toISOString() };
      setSending(true);
      setMessages(prev => [...prev, optimistic]);
      const messageContent = content;
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '44px';
      }
      await api(`/api/chat/rooms/${current}/messages`, { method: 'POST', token: token ?? undefined, body: { content: messageContent } });
      
      // Обновляем время просмотра комнаты сразу после отправки сообщения
      // Это гарантирует, что собственное сообщение не будет считаться непрочитанным
      const now = new Date();
      const roomViews = JSON.parse(localStorage.getItem('chat_room_views') || '{}');
      roomViews[current] = now.toISOString();
      localStorage.setItem('chat_room_views', JSON.stringify(roomViews));
      
      // Обновляем счетчик непрочитанных
      window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { roomId: current } }));
      
      await loadMessages(current);
    } catch (e: any) { setError(e.message || 'Failed to send'); }
    finally { setSending(false); }
  }


  // Rooms list no longer rendered directly; kept loading state for UX

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <UniversalNavbar />
      {/* Main area with chat layout */}
      <main style={{ 
        flex: 1, 
        padding: '0', 
        maxWidth: '100%', 
        overflowX: 'hidden', 
        display: 'flex', 
        alignItems: 'stretch', 
        justifyContent: 'stretch',
        background: 'var(--bg)'
      }}>
        {/* Chat container - Telegram style */}
        <div style={{ 
          width: '100%', 
          maxWidth: '100%', 
          height: 'calc(100vh - 80px)', 
          display: isMobileView ? 'flex' : 'grid', 
          gridTemplateColumns: isMobileView ? 'none' : (sidebarCollapsed ? '0 1fr' : 'minmax(260px, 320px) 1fr'), 
          gap: 0, 
          background: 'var(--surface)', 
          borderRadius: 0,
          overflow: 'hidden',
          boxShadow: 'none',
          border: 'none'
        }}>
          <style>{`
            /* Custom scrollbar styles */
            div[style*="overflowY: auto"]::-webkit-scrollbar {
              width: 6px;
            }
            div[style*="overflowY: auto"]::-webkit-scrollbar-track {
              background: transparent;
            }
            div[style*="overflowY: auto"]::-webkit-scrollbar-thumb {
              background: rgba(255,255,255,0.2);
              border-radius: 3px;
            }
            div[style*="overflowY: auto"]::-webkit-scrollbar-thumb:hover {
              background: rgba(255,255,255,0.3);
            }
          `}</style>
          {/* Clients list (chat sidebar) - Telegram style */}
          <div style={{ 
            display: isMobileView ? (showChatScreen ? 'none' : 'flex') : (sidebarCollapsed ? 'none' : 'flex'),
            background: 'var(--surface-2)', 
            borderRight: isMobileView ? 'none' : '1px solid rgba(255,255,255,0.08)', 
            flexDirection: 'column',
            minWidth: 0,
            width: isMobileView ? '100%' : 'auto',
            height: '100%'
          }}>
            {/* Sidebar header */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              background: 'var(--surface-2)'
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))' }} />
              <b style={{ fontSize: 16, fontWeight: 700 }}>{isClient ? 'Мой психолог' : 'Сообщения'}</b>
            </div>
            {/* Sidebar content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {isClient ? (
                psychologist ? (() => {
                  // Используем имя клиента для поиска активной комнаты
                  const isActive = !!current;
                  const psychName = psychologist.name || psychologist.email?.split('@')[0] || 'Психолог';
                  const psychAvatar = psychologist.avatarUrl;
                  return (
                    <div style={{ padding: '12px' }}>
                      <button 
                        onClick={() => {
                          ensureRoomForPsychologist();
                          if (isMobileView) {
                            setShowChatScreen(true);
                          }
                        }}
                        style={{ 
                          width: '100%', 
                          justifyContent: 'flex-start', 
                          padding: '12px', 
                          fontSize: 14, 
                          display: 'flex', 
                          gap: 12, 
                          alignItems: 'center',
                          cursor: 'pointer',
                          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                          border: 'none',
                          borderRadius: 12,
                          color: 'var(--text)',
                          transition: 'background 0.2s'
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
                      {psychAvatar ? (
                        <img 
                          src={getAvatarUrl(psychAvatar, psychologist.id) || undefined} 
                          alt={psychName}
                          style={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: 999, 
                            objectFit: 'cover',
                            border: '2px solid var(--primary)',
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
                              fallback.textContent = psychName.charAt(0).toUpperCase();
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                          {psychName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{psychName}</div>
                        <div className="small" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{psychologist.email || '—'}</div>
                      </div>
                    </button>
                  </div>
                  );
                })() : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>👤</div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Психолог не назначен</div>
                    <div className="small" style={{ fontSize: 12, opacity: 0.7 }}>Обратитесь к администратору</div>
                  </div>
                )
              ) : (
                <>
                  {/* Search */}
                  <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <input 
                      placeholder="Поиск" 
                      value={query} 
                      onChange={e => setQuery(e.target.value)} 
                      style={{ 
                        width: '100%', 
                        padding: '10px 16px', 
                        borderRadius: 12, 
                        border: '1px solid rgba(255,255,255,0.12)', 
                        background: 'var(--surface)', 
                        color: 'var(--text)',
                        fontSize: 14
                      }} 
                    />
                  </div>
                  
                  {/* Clients list */}
                  <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '8px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.2) transparent'
                  }}>
                    {(clients || []).filter(c => (c.name || '').toLowerCase().includes(query.toLowerCase())).map(c => {
                      const isActive = rooms.find(r => r.id === current)?.name === c.name;
                      return (
                        <button 
                          key={c.id} 
                          onClick={() => {
                            ensureRoomForClient(c);
                            if (isMobileView) {
                              setShowChatScreen(true);
                            }
                          }} 
                          style={{ 
                            width: '100%',
                            justifyContent: 'flex-start', 
                            padding: '12px', 
                            fontSize: 14, 
                            display: 'flex', 
                            gap: 12, 
                            alignItems: 'center',
                            background: isActive ? 'rgba(91, 124, 250, 0.15)' : 'transparent',
                            border: 'none',
                            borderRadius: 12,
                            color: 'var(--text)',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            marginBottom: 2
                          }}
                          onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                          onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
                        >
                          {getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) ? (
                            <img
                              src={getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) || ''}
                              key={`avatar-${c.id}-${c.avatarUrl || c.profile?.avatarUrl || 'none'}`}
                              alt={c.name || 'Аватар'}
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
                                  fallback.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div style={{ width: 48, height: 48, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                              {(c.name || '?').trim().charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Клиент'}</div>
                            <div className="small" style={{ color: 'var(--text-muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '—'}</div>
                          </div>
                        </button>
                      );
                    })}
                    {!clients?.length && <div className="small" style={{ opacity: .7, padding: '20px', textAlign: 'center' }}>Нет клиентов</div>}
                  </div>
                  
                  {/* Create chat button */}
                  <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <button 
                      className="button" 
                      type="button" 
                      onClick={() => { setShowClientsModal(true); setModalQuery(''); }} 
                      style={{ 
                        width: '100%',
                        padding: '12px', 
                        fontSize: 14,
                        fontWeight: 600
                      }}
                    >
                      Создать чат
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chat area - Telegram style */}
          <div style={{ 
            display: isMobileView ? (showChatScreen ? 'flex' : 'none') : 'flex', 
            flexDirection: 'column', 
            background: 'var(--surface)', 
            minWidth: 0, 
            maxWidth: '100%',
            width: isMobileView ? '100%' : 'auto',
            height: '100%'
          }}>
            {/* Chat header */}
            {current ? (
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', 
                alignItems: 'center', 
                gap: 12,
                background: 'var(--surface-2)',
                flexShrink: 0
              }}>
                {isMobileView ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatScreen(false);
                      setCurrent(null);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 18,
                      marginRight: 8
                    }}
                    title="Назад к списку чатов"
                  >
                    ←
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 18,
                      marginRight: 8
                    }}
                    title={sidebarCollapsed ? 'Показать список чатов' : 'Скрыть список чатов'}
                  >
                    ☰
                  </button>
                )}
                <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rooms.find(r => r.id === current)?.name || 'Чат'}
                </div>
              </div>
            ) : (
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'var(--surface-2)',
                flexShrink: 0
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>Выберите чат для начала общения</div>
              </div>
            )}
            
            {/* Messages area */}
            <div 
              ref={messagesContainerRef}
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '20px',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                scrollBehavior: 'smooth',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.2) transparent'
              }}
            >
              {loadingMessages && (
                <div className="small" style={{ opacity: .7, textAlign: 'center', padding: '20px' }}>
                  Загрузка сообщений…
                </div>
              )}
              {!current && !loadingMessages && (
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
                  <div style={{ fontSize: 48, opacity: 0.5, marginBottom: 8 }}>💬</div>
                  <div>Выберите чат из списка слева</div>
                </div>
              )}
              {current && messages.length === 0 && !loadingMessages && (
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
                  <div style={{ fontSize: 48, opacity: 0.5, marginBottom: 8 }}>✉️</div>
                  <div>Нет сообщений. Начните общение!</div>
                </div>
              )}
              {messages.map((m, idx) => {
                const mine = m.authorId === user?.id;
                const prevMessage = idx > 0 ? messages[idx - 1] : null;
                const isGrouped = prevMessage && 
                  prevMessage.authorId === m.authorId && 
                  new Date(m.createdAt || Date.now()).getTime() - new Date(prevMessage.createdAt || Date.now()).getTime() < 300000; // 5 минут
                
                return (
                  <div 
                    key={m.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: mine ? 'flex-end' : 'flex-start', 
                      alignItems: 'flex-end',
                      gap: 8,
                      padding: isGrouped ? '1px 0' : '4px 0',
                      marginTop: isGrouped ? 0 : 4
                    }}
                  >
                    {!mine && (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: 14,
                          background: isGrouped
                            ? 'transparent'
                            : 'linear-gradient(135deg, var(--primary), var(--accent))',
                          color: isGrouped ? 'transparent' : '#0b0f1a',
                          transition: 'background 0.2s, color 0.2s'
                        }}
                        aria-hidden={isGrouped}
                      >
                        {!isGrouped &&
                          (rooms.find(r => r.id === current)?.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ 
                      maxWidth: '65%', 
                      minWidth: '80px',
                      background: mine 
                        ? 'linear-gradient(135deg, var(--primary), var(--accent))' 
                        : 'var(--surface-2)', 
                      color: mine ? '#0b0f1a' : 'var(--text)', 
                      borderRadius: mine 
                        ? (isGrouped ? '18px 18px 4px 18px' : '18px 18px 4px 18px')
                        : (isGrouped ? '18px 18px 18px 4px' : '18px 18px 18px 4px'),
                      padding: '10px 14px', 
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      lineHeight: 1.4,
                      fontSize: 15,
                      boxShadow: mine ? '0 2px 8px rgba(91, 124, 250, 0.25)' : '0 1px 2px rgba(0,0,0,0.1)',
                      position: 'relative',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ marginBottom: 2 }}>{m.content}</div>
                      <div style={{ 
                        fontSize: 11, 
                        opacity: mine ? 0.75 : 0.55, 
                        textAlign: 'right',
                        marginTop: 4,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: 4,
                        lineHeight: 1
                      }}>
                        {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {mine && <span style={{ fontSize: 13 }}>✓</span>}
                      </div>
                    </div>
                    {mine && <div style={{ width: 32, flexShrink: 0 }} aria-hidden />}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            
            {/* Message input */}
            {current && (
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
            )}
            {error && (
              <div style={{ 
                padding: '8px 16px',
                color: '#ff6b6b', 
                fontSize: 13,
                background: 'rgba(255, 107, 107, 0.1)',
                borderTop: '1px solid rgba(255,255,255,0.08)'
              }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </main>

      {showClientsModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(5,8,16,0.75)', 
            backdropFilter: 'blur(8px)', 
            display: 'grid', 
            placeItems: 'center', 
            zIndex: 1000, 
            padding: 16 
          }} 
          onClick={() => setShowClientsModal(false)}
        >
          <div 
            className="card" 
            style={{ 
              width: 'min(500px, 94vw)', 
              maxHeight: '80vh', 
              overflow: 'hidden', 
              padding: 0, 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: 16, 
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ 
              padding: '20px', 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center'
            }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Выберите пациента</div>
              <button 
                className="button secondary" 
                onClick={() => setShowClientsModal(false)} 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: 13,
                  borderRadius: 8
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Search */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <input 
                placeholder="Поиск пациента" 
                value={modalQuery} 
                onChange={e => setModalQuery(e.target.value)} 
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: 12, 
                  border: '1px solid rgba(255,255,255,0.12)', 
                  background: 'var(--surface-2)', 
                  color: 'var(--text)',
                  fontSize: 14
                }} 
              />
            </div>
            
            {/* Clients list */}
            <div style={{ 
              flex: 1,
              overflowY: 'auto', 
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              {(clients || []).filter(c => (c.name || '').toLowerCase().includes(modalQuery.toLowerCase())).map(c => (
                <button 
                  key={c.id} 
                  onClick={() => ensureRoomForClient(c)} 
                  style={{ 
                    width: '100%',
                    justifyContent: 'flex-start', 
                    padding: '12px', 
                    display: 'flex', 
                    gap: 12, 
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 12,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) ? (
                    <img
                      src={getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) || ''}
                      key={`avatar-${c.id}-${c.avatarUrl || c.profile?.avatarUrl || 'none'}`}
                      alt={c.name || 'Аватар'}
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
                          fallback.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
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
                      {(c.name || '?').trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: 15,
                      marginBottom: 2,
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {c.name || 'Клиент'}
                    </div>
                    <div className="small" style={{ 
                      color: 'var(--text-muted)', 
                      fontSize: 13,
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {c.email || '—'}
                    </div>
                  </div>
                </button>
              ))}
              {!clients?.length && (
                <div className="small" style={{ 
                  opacity: .7, 
                  padding: '40px 20px',
                  textAlign: 'center' 
                }}>
                  Нет пациентов
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
