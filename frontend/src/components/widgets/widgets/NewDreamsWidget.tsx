import { PlatformIcon } from '../../icons';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function NewDreamsWidget({ data }: Props) {
  const iconSize = typeof window !== 'undefined' && window.innerWidth <= 640 ? 22 : 32;
  return (
    <>
      <div style={{ marginBottom: 8, color: 'var(--primary)' }}>
        <PlatformIcon name="dreams" size={iconSize} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{data?.newDreams || 0}</div>
      <div className="small" style={{ color: 'var(--text-muted)' }}>Новых снов (неделя)</div>
    </>
  );
}
