
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function ActiveSessionsWidget({ data }: Props) {
  return (
    <>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{data?.activeSessions || 0}</div>
      <div className="small" style={{ color: 'var(--text-muted)' }}>Активных сессий</div>
    </>
  );
}
