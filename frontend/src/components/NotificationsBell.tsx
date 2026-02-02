import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
};

export function NotificationsBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api<{ items: Notification[]; unreadCount: number }>('/api/notifications', { token });
      setNotifications(res.items || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadNotifications();
      // Обновляем уведомления каждые 30 секунд
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    if (!token) return;
    try {
      await api(`/api/notifications/${id}/read`, { method: 'PUT', token });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const markAllAsRead = async () => {
    if (!token || unreadCount === 0) return;
    try {
      await api('/api/notifications/read-all', { method: 'PUT', token });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!token) return;
    try {
      await api(`/api/notifications/${id}`, { method: 'DELETE', token });
      setNotifications(prev => prev.filter(n => n.id !== id));
      const deleted = notifications.find(n => n.id === id);
      if (deleted && !deleted.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Failed to delete notification:', e);
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      new_dream: '💭',
      new_journal: '📝',
      session_reminder: '📅',
      homework_due: '📋',
      new_message: '💬',
      client_registered: '👤',
      profile_updated: '✏️',
      default: '🔔'
    };
    return icons[type] || icons.default;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  if (!token) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          border: 'none',
          background: 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 20,
          padding: 0,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Уведомления"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: 'var(--accent)',
              color: '#0b0f1a',
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

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 380,
            maxWidth: '90vw',
            maxHeight: '80vh',
            background: 'var(--surface)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Уведомления</div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 6,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                Отметить все как прочитанные
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: 'calc(80vh - 120px)'
            }}
          >
            {loading && notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="small">Загрузка...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
                <div className="small">Нет уведомлений</div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: notification.read ? 'transparent' : 'rgba(91, 124, 250, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (notification.read) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (notification.read) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 20, flexShrink: 0 }}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: notification.read ? 500 : 700,
                          fontSize: 14,
                          marginBottom: 4,
                          color: notification.read ? 'var(--text)' : 'var(--text)'
                        }}
                      >
                        {notification.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                          marginBottom: 6
                        }}
                      >
                        {notification.message}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          opacity: 0.7
                        }}
                      >
                        {formatDate(notification.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 12,
                        opacity: 0.5,
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.5';
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                  {!notification.read && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--primary)'
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
