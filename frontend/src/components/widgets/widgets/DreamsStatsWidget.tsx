
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function DreamsStatsWidget({ data, size }: Props) {
  const newDreams = data?.newDreams || 0;
  const topClients = data?.topClients || [];
  const totalDreams = topClients.reduce((sum: number, client: any) => sum + (client.dreamsCount || 0), 0);
  const avgDreamsPerClient = topClients.length > 0 ? Math.round(totalDreams / topClients.length) : 0;

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>💤 Статистика снов</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ 
          padding: 16, 
          background: 'linear-gradient(135deg, rgba(91, 124, 250, 0.1), rgba(138, 43, 226, 0.1))', 
          borderRadius: 12,
          border: '1px solid rgba(91, 124, 250, 0.2)'
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Новые сны (неделя)
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>
            {newDreams}
          </div>
        </div>
        {size !== 'small' && (
          <>
            <div style={{ 
              padding: 16, 
              background: 'var(--surface-2)', 
              borderRadius: 12
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Всего снов
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {totalDreams}
              </div>
            </div>
            <div style={{ 
              padding: 16, 
              background: 'var(--surface-2)', 
              borderRadius: 12
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Среднее на клиента
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {avgDreamsPerClient}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
