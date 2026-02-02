import { Link } from 'react-router-dom';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function TopClientsWidget({ data, size }: Props) {
  const topClients = data?.topClients || [];
  const limit = size === 'small' ? 3 : size === 'medium' ? 5 : 10;

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>⭐ Топ клиенты по активности</h3>
      {topClients.length === 0 ? (
        <div className="small" style={{ color: 'var(--text-muted)' }}>Нет данных</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {topClients.slice(0, limit).map((client: any, idx: number) => (
            <div
              key={client.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: 'var(--surface-2)',
                borderRadius: 8
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {idx + 1}. {client.name}
                </div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  {client.dreamsCount} снов · {client.sessionsCount} сессий
                </div>
              </div>
              <Link
                to={`/clients/${client.id}/profile`}
                className="button secondary"
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                Открыть
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
