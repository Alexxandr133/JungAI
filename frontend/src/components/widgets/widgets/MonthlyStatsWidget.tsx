import { PlatformIcon } from '../../icons';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function MonthlyStatsWidget({ data, size }: Props) {
  const totalClients = data?.totalClients || 0;
  const activeSessions = data?.activeSessions || 0;
  const topClients = data?.topClients || [];
  
  const totalDreams = topClients.reduce((sum: number, client: any) => sum + (client.dreamsCount || 0), 0);
  const totalSessions = topClients.reduce((sum: number, client: any) => sum + (client.sessionsCount || 0), 0);

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <PlatformIcon name="calendar" size={22} strokeWidth={1.75} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        Статистика за месяц
      </h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: 12,
          background: 'var(--surface-2)',
          borderRadius: 8
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
              Всего клиентов
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {totalClients}
            </div>
          </div>
          <div style={{ color: 'var(--primary)' }}>
            <PlatformIcon name="users" size={26} strokeWidth={1.5} />
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: 12,
          background: 'var(--surface-2)',
          borderRadius: 8
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
              Активных сессий
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {activeSessions}
            </div>
          </div>
          <div style={{ color: 'var(--primary)' }}>
            <PlatformIcon name="calendar" size={26} strokeWidth={1.5} />
          </div>
        </div>
        {size !== 'small' && (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: 12,
              background: 'var(--surface-2)',
              borderRadius: 8
            }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Всего снов
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {totalDreams}
                </div>
              </div>
              <div style={{ color: 'var(--primary)' }}>
                <PlatformIcon name="dreams" size={26} strokeWidth={1.5} />
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: 12,
              background: 'var(--surface-2)',
              borderRadius: 8
            }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Всего сессий
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {totalSessions}
                </div>
              </div>
              <div style={{ color: 'var(--primary)' }}>
                <PlatformIcon name="chart" size={26} strokeWidth={1.5} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
