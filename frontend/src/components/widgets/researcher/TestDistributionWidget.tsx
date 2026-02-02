
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
}

export default function TestDistributionWidget({ data, size }: Props) {
  const tests = data?.distributions?.tests || {};
  const entries = Object.entries(tests).slice(0, size === 'small' ? 5 : size === 'medium' ? 10 : 20);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Распределение тестов</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div className="small" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>Нет данных</div>
        ) : (
          entries.map(([testType, count]: [string, any], idx: number) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 8
              }}
            >
              <div style={{ fontWeight: 600 }}>{testType}</div>
              <div className="small" style={{ color: 'var(--text-muted)' }}>{count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
