import { PlatformIcon } from '../../icons';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function UnanalyzedDreamsWidget({ data }: Props) {
  const count = data?.requiresAttention?.dreamsWithoutAnalysis?.length || 0;
  return (
    <>
      <div style={{ marginBottom: 8, color: '#a78bfa' }}>
        <PlatformIcon name="dreams" size={28} strokeWidth={1.75} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{count}</div>
      <div className="small" style={{ color: 'var(--text-muted)' }}>Сны без анализа</div>
    </>
  );
}

