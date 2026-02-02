
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
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>📅 Статистика за месяц</h3>
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
          <div style={{ fontSize: 24 }}>👥</div>
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
          <div style={{ fontSize: 24 }}>📅</div>
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
              <div style={{ fontSize: 24 }}>💭</div>
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
              <div style={{ fontSize: 24 }}>📊</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
