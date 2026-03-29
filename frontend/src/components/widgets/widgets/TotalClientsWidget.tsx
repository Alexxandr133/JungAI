import { PlatformIcon } from '../../icons';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function TotalClientsWidget({ data }: Props) {
  return (
    <>
      <div style={{ marginBottom: 8, color: 'var(--primary)' }}>
        <PlatformIcon name="users" size={32} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{data?.totalClients || 0}</div>
      <div className="small" style={{ color: 'var(--text-muted)' }}>Всего клиентов</div>
    </>
  );
}
