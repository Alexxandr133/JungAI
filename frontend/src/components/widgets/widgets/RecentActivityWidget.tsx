import { Link } from 'react-router-dom';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function RecentActivityWidget({ data, size }: Props) {
  const newDreams = data?.newDreams || 0;
  const newJournalEntries = data?.newJournalEntries || 0;
  const topClients = data?.topClients || [];
  const limit = size === 'small' ? 3 : size === 'medium' ? 5 : 8;

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>🕐 Последние активности</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ 
          padding: 12, 
          background: 'var(--surface-2)', 
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Новые сны</div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              За последнюю неделю
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>
            {newDreams}
          </div>
        </div>
        <div style={{ 
          padding: 12, 
          background: 'var(--surface-2)', 
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Записи в дневниках</div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              За последнюю неделю
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
            {newJournalEntries}
          </div>
        </div>
        {size !== 'small' && topClients.length > 0 && (
          <div>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              color: 'var(--text-muted)', 
              marginBottom: 8 
            }}>
              Самые активные клиенты:
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {topClients.slice(0, limit).map((client: any) => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}/profile`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 8,
                    background: 'var(--surface)',
                    borderRadius: 6,
                    textDecoration: 'none',
                    color: 'var(--text)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                    e.currentTarget.style.background = 'var(--surface)';
                  }}
                >
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{client.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {client.totalActivity} активность
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
