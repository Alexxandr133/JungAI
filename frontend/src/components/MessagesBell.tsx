import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PlatformIcon } from './icons';

export function MessagesBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    if (!token) return;
    try {
      // Получаем время последнего просмотра комнат из localStorage
      const roomViews = localStorage.getItem('chat_room_views');
      const url = roomViews 
        ? `/api/chat/unread-count?roomViews=${encodeURIComponent(roomViews)}`
        : '/api/chat/unread-count';
      const res = await api<{ unreadCount: number }>(url, { token });
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      console.error('Failed to load unread messages count:', e);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (token) {
      loadUnreadCount();
      // Обновляем счетчик каждые 30 секунд
      const interval = setInterval(loadUnreadCount, 30000);
      
      // Слушаем событие открытия комнаты чата для немедленного обновления счетчика
      const handleRoomOpened = () => {
        // Небольшая задержка, чтобы дать время обновиться localStorage
        setTimeout(loadUnreadCount, 100);
      };
      
      window.addEventListener('chat-room-opened', handleRoomOpened);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('chat-room-opened', handleRoomOpened);
      };
    }
  }, [token]);

  if (!token) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => navigate('/chat')}
        style={{
          position: 'relative',
          border: 'none',
          background: 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
          padding: 6,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10
        }}
        title="Сообщения"
      >
        <PlatformIcon name="messages" size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: '#ef4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
              padding: '0 4px',
              border: '2px solid var(--surface)'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

