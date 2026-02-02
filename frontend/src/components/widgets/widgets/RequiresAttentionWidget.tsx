import { Link } from 'react-router-dom';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function RequiresAttentionWidget({ data }: Props) {
  const requiresAttention = data?.requiresAttention || {};
  const clientsWithoutSessions = requiresAttention.clientsWithoutSessions || [];
  const dreamsWithoutAnalysis = requiresAttention.dreamsWithoutAnalysis || [];
  const total = clientsWithoutSessions.length + dreamsWithoutAnalysis.length;

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>⚠️ Требуют внимания</h3>
      {total === 0 ? (
        <div className="small" style={{ color: 'var(--text-muted)' }}>
          Все в порядке! Нет элементов, требующих внимания.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {clientsWithoutSessions.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 8
                }}
              >
                Клиенты без сессий (14+ дней):
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {clientsWithoutSessions.map((client: any) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}/profile`}
                    style={{
                      display: 'block',
                      padding: 10,
                      background: 'rgba(255, 193, 7, 0.1)',
                      border: '1px solid rgba(255, 193, 7, 0.2)',
                      borderRadius: 8,
                      color: 'var(--text)',
                      textDecoration: 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 193, 7, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 193, 7, 0.1)';
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{client.name}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {dreamsWithoutAnalysis.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 8
                }}
              >
                Сны без анализа:
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {dreamsWithoutAnalysis.map((dream: any) => (
                  <Link
                    key={dream.id}
                    to={`/dreams/${dream.id}`}
                    style={{
                      display: 'block',
                      padding: 10,
                      background: 'rgba(91, 124, 250, 0.1)',
                      border: '1px solid rgba(91, 124, 250, 0.2)',
                      borderRadius: 8,
                      color: 'var(--text)',
                      textDecoration: 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(91, 124, 250, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(91, 124, 250, 0.1)';
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{dream.title || 'Без названия'}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
