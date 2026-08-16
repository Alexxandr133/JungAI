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
      <div style={{ marginBottom: 8, color: 'var(--warning, #b97f2e)' }}>
        <PlatformIcon name="alertTriangle" size={28} strokeWidth={1.75} />
      </div>
      {count > 0 ? (
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{count}</div>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft, var(--text-muted))' }}>
          Всё в порядке
        </div>
      )}
      <div className="small" style={{ color: 'var(--ink-soft, var(--text-muted))' }}>Клиенты без сессий</div>
    </>
  );
}
