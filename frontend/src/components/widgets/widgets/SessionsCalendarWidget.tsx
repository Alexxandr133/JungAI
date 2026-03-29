import { Link } from 'react-router-dom';
import { PlatformIcon } from '../../icons';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function SessionsCalendarWidget({ data, size }: Props) {
  // Симулируем данные сессий (в реальности они должны приходить с бэкенда)
  const activeSessions = data?.activeSessions || 0;
  const topClients = data?.topClients || [];
  
  // Создаем примерные данные для демонстрации
  const upcomingSessions = topClients.slice(0, size === 'small' ? 2 : size === 'medium' ? 4 : 6).map((client: any, idx: number) => {
    const date = new Date();
    date.setDate(date.getDate() + idx + 1);
    return {
      id: `session-${idx}`,
      clientId: client.id,
      clientName: client.name,
      date: date,
      time: `${10 + idx * 2}:00`
    };
  });

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <PlatformIcon name="calendarDays" size={22} strokeWidth={1.75} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        Ближайшие сессии
      </h3>
      {activeSessions === 0 ? (
        <div className="small" style={{ color: 'var(--text-muted)' }}>
          Нет запланированных сессий
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {upcomingSessions.map((session: any) => (
            <Link
              key={session.id}
              to={`/clients/${session.clientId}/profile`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: 'var(--surface-2)',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'var(--text)',
                transition: 'all 0.2s',
                border: '1px solid transparent'
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                e.currentTarget.style.background = 'var(--surface-2)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{session.clientName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {session.date.toLocaleDateString('ru-RU', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                  })} в {session.time}
                </div>
              </div>
              <div style={{ 
                fontSize: 20,
                color: 'var(--primary)'
              }}>
                →
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
