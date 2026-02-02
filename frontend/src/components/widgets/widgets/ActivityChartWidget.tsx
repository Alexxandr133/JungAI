
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function ActivityChartWidget({ data }: Props) {
  // Простая визуализация активности
  const topClients = data?.topClients || [];
  const maxActivity = Math.max(...topClients.map((c: any) => c.totalActivity), 1);

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>📊 График активности клиентов</h3>
      {topClients.length === 0 ? (
        <div className="small" style={{ color: 'var(--text-muted)' }}>Нет данных</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {topClients.slice(0, 8).map((client: any) => {
            const percentage = (client.totalActivity / maxActivity) * 100;
            return (
              <div key={client.id} style={{ display: 'grid', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{client.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {client.totalActivity} активность
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    background: 'var(--surface-2)',
                    borderRadius: 4,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                      borderRadius: 4,
                      transition: 'width 0.3s'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
