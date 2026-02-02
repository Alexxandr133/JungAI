
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function TopSymbolsWidget({ data, size }: Props) {
  const topSymbols = data?.topSymbols || [];
  const limit = size === 'small' ? 5 : size === 'medium' ? 8 : 15;

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>🔮 Частые символы</h3>
      {topSymbols.length === 0 ? (
        <div className="small" style={{ color: 'var(--text-muted)' }}>Нет данных</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {topSymbols.slice(0, limit).map((item: any, idx: number) => (
            <div
              key={item.symbol}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 8,
                background: 'var(--surface-2)',
                borderRadius: 6
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>
                  {idx + 1}. {item.symbol}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                {item.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
