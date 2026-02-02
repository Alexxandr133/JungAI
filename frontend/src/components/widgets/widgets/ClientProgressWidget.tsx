import { Link } from 'react-router-dom';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function ClientProgressWidget({ data, size }: Props) {
  const topClients = data?.topClients || [];
  const limit = size === 'small' ? 3 : size === 'medium' ? 5 : 8;
  
  // Вычисляем максимальные значения для нормализации
  const maxDreams = Math.max(...topClients.map((c: any) => c.dreamsCount || 0), 1);
  const maxSessions = Math.max(...topClients.map((c: any) => c.sessionsCount || 0), 1);

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>📈 Прогресс клиентов</h3>
      {topClients.length === 0 ? (
        <div className="small" style={{ color: 'var(--text-muted)' }}>Нет данных</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {topClients.slice(0, limit).map((client: any) => {
            const dreamsProgress = ((client.dreamsCount || 0) / maxDreams) * 100;
            const sessionsProgress = ((client.sessionsCount || 0) / maxSessions) * 100;
            
            return (
              <Link
                key={client.id}
                to={`/clients/${client.id}/profile`}
                style={{
                  display: 'block',
                  padding: 12,
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: 'var(--text)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>
                  {client.name}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: 12, 
                      marginBottom: 4,
                      color: 'var(--text-muted)'
                    }}>
                      <span>Сны: {client.dreamsCount || 0}</span>
                      <span>{Math.round(dreamsProgress)}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: 6,
                      background: 'var(--surface)',
                      borderRadius: 3,
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          width: `${dreamsProgress}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                          borderRadius: 3,
                          transition: 'width 0.3s'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: 12, 
                      marginBottom: 4,
                      color: 'var(--text-muted)'
                    }}>
                      <span>Сессии: {client.sessionsCount || 0}</span>
                      <span>{Math.round(sessionsProgress)}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: 6,
                      background: 'var(--surface)',
                      borderRadius: 3,
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          width: `${sessionsProgress}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--accent), var(--primary))',
                          borderRadius: 3,
                          transition: 'width 0.3s'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
