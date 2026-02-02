
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
}

export default function TotalSessionsWidget({ data }: Props) {
  const count = data?.counts?.sessions || 0;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Всего сессий</div>
      <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{count.toLocaleString()}</div>
    </div>
  );
}
