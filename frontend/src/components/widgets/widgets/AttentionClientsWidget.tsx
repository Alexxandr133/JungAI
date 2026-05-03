import { PlatformIcon } from '../../icons';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function AttentionClientsWidget({ data }: Props) {
  const count = data?.requiresAttention?.clientsWithoutSessions?.length || 0;
  return (
    <>
      <div style={{ marginBottom: 8, color: '#f59e0b' }}>
        <PlatformIcon name="alertTriangle" size={28} strokeWidth={1.75} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{count}</div>
      <div className="small" style={{ color: 'var(--text-muted)' }}>Клиенты без сессий</div>
    </>
  );
}

